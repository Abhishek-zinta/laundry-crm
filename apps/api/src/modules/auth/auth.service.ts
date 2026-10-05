import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AuditAction,
  ChangePasswordInput,
  LoginInput,
  permissionsForRole,
  RegisterInput,
  Role,
  ROLE_HOME,
  slugify,
} from '@rinseops/shared';
import { env } from '../../config/env';
import type { AuthContext } from '../../common/auth/auth-context';
import { generateSessionToken, hashSessionToken } from '../../common/auth/session-token';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, conflict } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { money } from '../../common/util/serialize';
import { provisionTenant } from '../tenants/tenant-provisioning';
import { getDummyHash, hashPassword, verifyPassword } from './password';

export interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict('EMAIL_TAKEN', 'An account with this email already exists. Try signing in.');

    const slug = await this.availableSlug(input.slug ?? slugify(input.businessName), Boolean(input.slug));
    const passwordHash = await hashPassword(input.password);

    const { owner } = await this.prisma.$transaction(
      (tx) =>
        provisionTenant(tx, {
          businessName: input.businessName,
          slug,
          ownerName: input.ownerName,
          ownerEmail: input.email,
          ownerPhone: input.phone ?? null,
          passwordHash,
          storeName: input.storeName,
          currency: input.currency,
          timezone: input.timezone,
        }),
      { timeout: 20000 },
    );

    return this.createSession(owner.id, meta);
  }

  async login(input: LoginInput, meta: SessionMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { tenant: { select: { status: true } } },
    });
    if (!user) {
      await verifyPassword(await getDummyHash(), input.password);
      throw invalidCredentials();
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) throw invalidCredentials();
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated. Contact your manager.', HttpStatus.FORBIDDEN);
    }
    if (user.tenant.status !== 'ACTIVE') {
      throw new AppError('TENANT_SUSPENDED', 'This business account is suspended.', HttpStatus.FORBIDDEN);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(
      this.prisma.forTenant(user.tenantId),
      { tenantId: user.tenantId, userId: user.id, ipAddress: meta.ipAddress },
      {
        action: AuditAction.USER_LOGIN,
        entityType: 'User',
        entityId: user.id,
      },
    );
    return this.createSession(user.id, meta);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async changePassword(ctx: AuthContext, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError('INVALID_PASSWORD', 'Your current password is incorrect.', HttpStatus.BAD_REQUEST);
    }
    // Keep the caller signed in on this device; sign out every other web and app session.
    const currentFamily =
      ctx.authType === 'mobile'
        ? (await this.prisma.mobileSession.findUnique({ where: { id: ctx.sessionId }, select: { familyId: true } }))?.familyId
        : undefined;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, ...(ctx.authType === 'cookie' ? { NOT: { id: ctx.sessionId } } : {}) },
        data: { revokedAt: new Date() },
      }),
      this.prisma.mobileSession.updateMany({
        where: { userId: user.id, revokedAt: null, ...(currentFamily ? { NOT: { familyId: currentFamily } } : {}) },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      }),
    ]);
  }

  /** Everything the web app needs to bootstrap after login. */
  async me(ctx: AuthContext) {
    const [user, tenant, stores] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { id: true, name: true, email: true, phone: true, role: true },
      }),
      this.prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, include: { settings: true } }),
      this.prisma.store.findMany({
        where: { tenantId: ctx.tenantId, id: { in: ctx.storeIds } },
        select: { id: true, name: true, code: true, phone: true, address: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const s = tenant.settings;
    return {
      user,
      permissions: [...permissionsForRole(user.role as Role)],
      home: ROLE_HOME[user.role as Role],
      allStores: ctx.allStores,
      stores,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        phone: tenant.phone,
        email: tenant.email,
        address: tenant.address,
        settings: s && {
          currency: s.currency,
          locale: s.locale,
          timezone: s.timezone,
          brandColor: s.brandColor,
          taxName: s.taxName,
          taxRate: money(s.taxRate),
          taxInclusive: s.taxInclusive,
          taxNumber: s.taxNumber,
          orderPrefix: s.orderPrefix,
          invoicePrefix: s.invoicePrefix,
          garmentPrefix: s.garmentPrefix,
          receiptFooter: s.receiptFooter,
          defaultTurnaroundHours: s.defaultTurnaroundHours,
          skipQualityCheck: s.skipQualityCheck,
          bookingEnabled: s.bookingEnabled,
          timeSlots: s.timeSlots,
          defaultPriceListId: s.defaultPriceListId,
        },
      },
    };
  }

  private async createSession(userId: string, meta: SessionMeta) {
    const token = generateSessionToken();
    const ttlDays = env().SESSION_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    return { token, expiresAt, home: ROLE_HOME[user.role as Role] };
  }

  private async availableSlug(base: string, explicit: boolean): Promise<string> {
    const root = base || 'laundry';
    if (!(await this.prisma.tenant.findUnique({ where: { slug: root } }))) return root;
    if (explicit) throw conflict('SLUG_TAKEN', 'That booking link is already taken. Try another.');
    for (let i = 2; i < 50; i++) {
      const candidate = `${root}-${i}`;
      if (!(await this.prisma.tenant.findUnique({ where: { slug: candidate } }))) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }
}

function invalidCredentials() {
  return new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', HttpStatus.UNAUTHORIZED);
}
