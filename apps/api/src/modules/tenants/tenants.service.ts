import { Injectable } from '@nestjs/common';
import { AuditAction, CreateStoreInput, UpdateStoreInput, UpdateTenantInput } from '@rinseops/shared';
import { AuthContext } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { badRequest, conflict, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';

const TENANT_FIELDS = ['name', 'logoUrl', 'phone', 'email', 'address'] as const;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async updateSettings(ctx: AuthContext, input: UpdateTenantInput) {
    if (input.timezone && !isValidTimeZone(input.timezone)) {
      throw badRequest('INVALID_TIMEZONE', 'Unknown timezone. Use an IANA name such as Asia/Kolkata.');
    }
    const db = this.prisma.forTenant(ctx.tenantId);
    if (input.defaultPriceListId) {
      const list = await db.priceList.findFirst({ where: { id: input.defaultPriceListId } });
      if (!list) throw notFound('Price list');
    }

    const tenantData: Record<string, unknown> = {};
    const settingsData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if ((TENANT_FIELDS as readonly string[]).includes(key)) tenantData[key] = value;
      else settingsData[key] = value;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(tenantData).length) {
        await tx.tenant.update({ where: { id: ctx.tenantId }, data: tenantData });
      }
      if (Object.keys(settingsData).length) {
        await tx.tenantSettings.update({ where: { tenantId: ctx.tenantId }, data: settingsData });
      }
    });
    await this.audit.log(db, ctx, {
      action: AuditAction.SETTINGS_UPDATED,
      entityType: 'Tenant',
      entityId: ctx.tenantId,
      metadata: { fields: Object.keys({ ...tenantData, ...settingsData }) },
    });
    return { ok: true };
  }

  listStores(ctx: AuthContext, includeInactive = false) {
    return this.prisma.forTenant(ctx.tenantId).store.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { users: true, racks: true } } },
    });
  }

  async createStore(ctx: AuthContext, input: CreateStoreInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    if (await db.store.findFirst({ where: { code: input.code } })) {
      throw conflict('STORE_CODE_TAKEN', `Store code ${input.code} is already used.`);
    }
    const store = await db.store.create({ data: { ...input, tenantId: ctx.tenantId } });
    await this.audit.log(db, ctx, {
      action: AuditAction.STORE_CREATED,
      entityType: 'Store',
      entityId: store.id,
      metadata: { name: store.name },
    });
    return store;
  }

  async updateStore(ctx: AuthContext, id: string, input: UpdateStoreInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const store = await db.store.findFirst({ where: { id } });
    if (!store) throw notFound('Store');
    if (input.code && input.code !== store.code && (await db.store.findFirst({ where: { code: input.code } }))) {
      throw conflict('STORE_CODE_TAKEN', `Store code ${input.code} is already used.`);
    }
    if (input.isActive === false) {
      const active = await db.store.count({ where: { isActive: true } });
      if (active <= 1 && store.isActive) throw badRequest('LAST_STORE', 'You need at least one active store.');
    }
    const updated = await db.store.update({ where: { id }, data: input });
    await this.audit.log(db, ctx, {
      action: AuditAction.STORE_UPDATED,
      entityType: 'Store',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
