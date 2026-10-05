import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '@rinseops/shared';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { generateSessionToken, hashSessionToken } from '../../common/auth/session-token';
import { AuditService } from '../../common/audit/audit.service';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getDummyHash, verifyPassword } from '../auth/password';
import { MobileTokenService } from './mobile-token.service';

export interface MobileTokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresAt: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface ClientMeta {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export const REVOKE_REASON = {
  ROTATED: 'ROTATED',
  LOGOUT: 'LOGOUT',
  REUSE_DETECTED: 'REUSE_DETECTED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ADMIN: 'ADMIN',
} as const;

const invalidRefresh = () =>
  new AppError('INVALID_REFRESH_TOKEN', 'Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED);

/**
 * Native-app authentication: short-lived JWT access tokens plus opaque,
 * rotating refresh tokens stored (hashed) in MobileSession.
 * The web cookie session flow is untouched.
 */
@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: MobileTokenService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: ClientMeta): Promise<MobileTokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { status: true } } },
    });
    if (!user) {
      await verifyPassword(await getDummyHash(), password);
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', HttpStatus.UNAUTHORIZED);
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.', HttpStatus.UNAUTHORIZED);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated. Contact your manager.', HttpStatus.FORBIDDEN);
    }
    if (user.tenant.status !== 'ACTIVE') {
      throw new AppError('TENANT_SUSPENDED', 'This business account is suspended.', HttpStatus.FORBIDDEN);
    }

    const pair = await this.issue(user.id, user.tenantId, randomUUID(), meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(
      this.prisma.forTenant(user.tenantId),
      { tenantId: user.tenantId, userId: user.id, ipAddress: meta.ipAddress },
      { action: AuditAction.USER_LOGIN, entityType: 'User', entityId: user.id, metadata: { channel: 'mobile', device: meta.deviceName ?? null } },
    );
    return pair;
  }

  /** Rotates the refresh token. Reusing an already-rotated token revokes the whole family. */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<MobileTokenPair> {
    const session = await this.prisma.mobileSession.findUnique({
      where: { refreshTokenHash: hashSessionToken(refreshToken) },
      include: { user: { include: { tenant: { select: { status: true } } } } },
    });
    if (!session) throw invalidRefresh();

    if (session.revokedAt) {
      if (session.revokedReason === REVOKE_REASON.ROTATED) {
        const { count } = await this.prisma.mobileSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: REVOKE_REASON.REUSE_DETECTED },
        });
        this.logger.warn(`Refresh token reuse detected for user ${session.userId}; revoked ${count} session(s) in family ${session.familyId}`);
      }
      throw invalidRefresh();
    }
    if (session.expiresAt <= new Date()) throw invalidRefresh();

    const { user } = session;
    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE' || user.tenantId !== session.tenantId) {
      await this.prisma.mobileSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: REVOKE_REASON.ACCOUNT_INACTIVE },
      });
      throw new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated. Contact your manager.', HttpStatus.UNAUTHORIZED);
    }

    return this.prisma.$transaction(async (tx) => {
      // Claim the old session atomically so two concurrent refreshes can't both succeed.
      const claimed = await tx.mobileSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: REVOKE_REASON.ROTATED },
      });
      if (claimed.count !== 1) throw invalidRefresh();
      const pair = await this.issue(user.id, user.tenantId, session.familyId, { ...meta, deviceName: meta.deviceName ?? session.deviceName ?? undefined }, tx);
      const next = await tx.mobileSession.findUniqueOrThrow({ where: { refreshTokenHash: hashSessionToken(pair.refreshToken) }, select: { id: true } });
      await tx.mobileSession.update({ where: { id: session.id }, data: { replacedById: next.id } });
      return pair;
    });
  }

  /** Revokes the refresh family of the given token. Always succeeds (idempotent). */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.mobileSession.findUnique({
      where: { refreshTokenHash: hashSessionToken(refreshToken) },
      select: { familyId: true },
    });
    if (!session) return;
    await this.prisma.mobileSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: REVOKE_REASON.LOGOUT },
    });
  }

  private async issue(
    userId: string,
    tenantId: string,
    familyId: string,
    meta: ClientMeta,
    db: Pick<PrismaService, 'mobileSession'> = this.prisma,
  ): Promise<MobileTokenPair> {
    const refreshToken = generateSessionToken();
    const refreshExpiresAt = new Date(Date.now() + env().MOBILE_REFRESH_TTL_DAYS * 86_400_000);
    const session = await db.mobileSession.create({
      data: {
        tenantId,
        userId,
        familyId,
        refreshTokenHash: hashSessionToken(refreshToken),
        expiresAt: refreshExpiresAt,
        deviceName: meta.deviceName?.slice(0, 120) ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });
    const access = this.tokens.sign({ sub: userId, tid: tenantId, sid: session.id });
    return {
      tokenType: 'Bearer',
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      expiresIn: this.tokens.accessTtlSeconds(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }
}

interface MobileSessionWriter {
  mobileSession: { updateMany(args: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date; revokedReason: string } }): Promise<unknown> };
}

/** Revokes every native-app session of a user (deactivation, password change). */
export async function revokeMobileSessionsForUser(db: MobileSessionWriter, userId: string, reason: string) {
  await db.mobileSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
}
