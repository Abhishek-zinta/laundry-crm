import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ASSIGNABLE_ROLES, AuditAction, CreateStaffInput, normalizePhone, Role, UpdateStaffInput } from '@rinseops/shared';
import { AuthContext } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword } from '../auth/password';
import { revokeMobileSessionsForUser } from '../mobile-auth/mobile-auth.service';

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  stores: { select: { store: { select: { id: true, name: true, code: true } } } },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: AuthContext) {
    const users = await this.prisma.forTenant(ctx.tenantId).user.findMany({
      select: STAFF_SELECT,
      orderBy: [{ status: 'asc' }, { role: 'asc' }, { name: 'asc' }],
    });
    return users.map(toStaff);
  }

  /** Active drivers, optionally limited to a store — used for task assignment. */
  async drivers(ctx: AuthContext, storeId?: string) {
    const users = await this.prisma.forTenant(ctx.tenantId).user.findMany({
      where: {
        role: Role.DRIVER,
        status: 'ACTIVE',
        ...(storeId ? { stores: { some: { storeId } } } : {}),
      },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    });
    return users;
  }

  async create(ctx: AuthContext, input: CreateStaffInput) {
    this.assertCanAssignRole(ctx, input.role);
    await this.assertStores(ctx, input.storeIds);
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw conflict('EMAIL_TAKEN', 'A user with this email already exists.');
    }
    const db = this.prisma.forTenant(ctx.tenantId);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone ? normalizePhone(input.phone) : null,
          role: input.role,
          passwordHash: await hashPassword(input.password),
        },
      });
      if (input.storeIds.length) {
        await tx.userStore.createMany({ data: input.storeIds.map((storeId) => ({ userId: created.id, storeId })) });
      }
      await this.audit.log(tx, ctx, {
        action: AuditAction.STAFF_CREATED,
        entityType: 'User',
        entityId: created.id,
        metadata: { name: created.name, role: created.role, storeIds: input.storeIds },
      });
      return created;
    });
    return this.get(ctx, user.id);
  }

  async get(ctx: AuthContext, id: string) {
    const user = await this.prisma.forTenant(ctx.tenantId).user.findFirst({ where: { id }, select: STAFF_SELECT });
    if (!user) throw notFound('Staff member');
    return toStaff(user);
  }

  async update(ctx: AuthContext, id: string, input: UpdateStaffInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const user = await db.user.findFirst({ where: { id } });
    if (!user) throw notFound('Staff member');

    const isSelf = user.id === ctx.userId;
    if (!isSelf) this.assertCanManageUser(ctx, user.role as Role);
    if (isSelf && (input.role || input.status || input.storeIds)) {
      throw badRequest('SELF_EDIT', "You can't change your own role, status or stores.");
    }
    if (input.role && input.role !== user.role) this.assertCanAssignRole(ctx, input.role);
    if (input.storeIds) await this.assertStores(ctx, input.storeIds);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone === undefined ? undefined : input.phone ? normalizePhone(input.phone) : null,
          role: input.role,
          status: input.status,
          passwordHash: input.password ? await hashPassword(input.password) : undefined,
        },
      });
      if (input.storeIds) {
        await tx.userStore.deleteMany({ where: { userId: id } });
        if (input.storeIds.length) {
          await tx.userStore.createMany({ data: input.storeIds.map((storeId) => ({ userId: id, storeId })) });
        }
      }
      if (input.status === 'INACTIVE' || input.password) {
        // Deactivation or a password reset signs the user out everywhere.
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await revokeMobileSessionsForUser(tx, id, input.status === 'INACTIVE' ? 'ACCOUNT_INACTIVE' : 'PASSWORD_CHANGED');
      }

      if (input.role && input.role !== user.role) {
        await this.audit.log(tx, ctx, {
          action: AuditAction.STAFF_ROLE_CHANGED,
          entityType: 'User',
          entityId: id,
          metadata: { name: user.name, from: user.role, to: input.role },
        });
      }
      if (input.status && input.status !== user.status) {
        await this.audit.log(tx, ctx, {
          action: AuditAction.STAFF_STATUS_CHANGED,
          entityType: 'User',
          entityId: id,
          metadata: { name: user.name, from: user.status, to: input.status },
        });
      }
      const other = Object.keys(input).filter((k) => !['role', 'status', 'password'].includes(k));
      if (other.length || input.password) {
        await this.audit.log(tx, ctx, {
          action: AuditAction.STAFF_UPDATED,
          entityType: 'User',
          entityId: id,
          metadata: { name: user.name, fields: [...other, ...(input.password ? ['password'] : [])] },
        });
      }
    });
    return this.get(ctx, id);
  }

  private assertCanAssignRole(ctx: AuthContext, role: Role) {
    if (!ASSIGNABLE_ROLES[ctx.role].includes(role)) {
      throw forbidden("You can't assign that role.", 'ROLE_NOT_ASSIGNABLE');
    }
  }

  private assertCanManageUser(ctx: AuthContext, targetRole: Role) {
    if (!ASSIGNABLE_ROLES[ctx.role].includes(targetRole)) {
      throw forbidden("You can't edit this staff member.", 'STAFF_NOT_MANAGEABLE');
    }
  }

  private async assertStores(ctx: AuthContext, storeIds: string[]) {
    if (!storeIds.length) return;
    const count = await this.prisma.forTenant(ctx.tenantId).store.count({ where: { id: { in: storeIds } } });
    if (count !== new Set(storeIds).size) throw notFound('Store');
    if (!ctx.allStores && storeIds.some((s) => !ctx.storeIds.includes(s))) {
      throw forbidden("You can't assign staff to a store you don't manage.", 'STORE_ACCESS_DENIED');
    }
  }
}

function toStaff(u: StaffRow) {
  const { stores, ...rest } = u;
  return { ...rest, stores: stores.map((s) => s.store) };
}
