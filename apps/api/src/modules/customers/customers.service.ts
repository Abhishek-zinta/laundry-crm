import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddressInput,
  AuditAction,
  CreateCustomerInput,
  CustomerListQuery,
  normalizePhone,
  phoneDigits,
  UpdateCustomerInput,
} from '@rinseops/shared';
import { AuthContext, storeScope } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { conflict, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantDbOrTx } from '../../common/prisma/tenant-extension';
import { money } from '../../common/util/serialize';

interface CustomerListRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  createdAt: Date;
  orderCount: number;
  totalSpent: Prisma.Decimal | null;
  balance: Prisma.Decimal | null;
  lastOrderAt: Date | null;
}

const SORTS: Record<CustomerListQuery['sort'], Prisma.Sql> = {
  recent: Prisma.sql`COALESCE(o."lastOrderAt", c."createdAt") DESC`,
  name: Prisma.sql`c."firstName" ASC, c."lastName" ASC`,
  orders: Prisma.sql`"orderCount" DESC`,
  spent: Prisma.sql`"totalSpent" DESC NULLS LAST`,
  balance: Prisma.sql`"balance" DESC NULLS LAST`,
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: AuthContext, query: CustomerListQuery) {
    const where = customerSearchSql(ctx.tenantId, query.q);
    const offset = (query.page - 1) * query.pageSize;
    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<CustomerListRow[]>`
        SELECT c.id, c."firstName", c."lastName", c.phone, c.email, c."createdAt",
               COALESCE(o."orderCount", 0)::int AS "orderCount",
               o."totalSpent", o.balance, o."lastOrderAt"
        FROM "Customer" c
        LEFT JOIN LATERAL (
          SELECT count(*) AS "orderCount", sum("grandTotal") AS "totalSpent",
                 sum("balanceDue") AS balance, max("createdAt") AS "lastOrderAt"
          FROM "Order"
          WHERE "tenantId" = c."tenantId" AND "customerId" = c.id AND status <> 'CANCELLED'
        ) o ON true
        WHERE ${where}
        ORDER BY ${SORTS[query.sort]}
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "Customer" c WHERE ${where}`,
    ]);
    return {
      items: rows.map((r) => ({
        ...r,
        totalSpent: money(r.totalSpent),
        balance: money(r.balance),
      })),
      total: Number(totalRows[0]?.count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Exact phone match — the counter's fastest path to a customer. */
  async lookupByPhone(ctx: AuthContext, phone: string) {
    const normalized = normalizePhone(phone);
    const db = this.prisma.forTenant(ctx.tenantId);
    const customer =
      (await db.customer.findFirst({ where: { phone: normalized, archivedAt: null } })) ??
      (normalized.length >= 6
        ? await db.customer.findFirst({ where: { phone: { endsWith: phoneDigits(normalized) }, archivedAt: null } })
        : null);
    return customer ? this.get(ctx, customer.id) : null;
  }

  async get(ctx: AuthContext, id: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const customer = await db.customer.findFirst({
      where: { id },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        priceList: { select: { id: true, name: true } },
      },
    });
    if (!customer) throw notFound('Customer');

    const [stats, openOrders] = await Promise.all([
      db.order.aggregate({
        where: { customerId: id, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { grandTotal: true, balanceDue: true },
        _max: { createdAt: true },
      }),
      db.order.findMany({
        where: { customerId: id, status: { in: ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY'] }, ...storeScope(ctx) },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          dueDate: true,
          grandTotal: true,
          balanceDue: true,
          paymentStatus: true,
          totalPieces: true,
          rackAssignments: {
            where: { removedAt: null },
            select: { rackSlot: { select: { code: true, rack: { select: { name: true, code: true } } } } },
          },
        },
      }),
    ]);

    return {
      ...customer,
      stats: {
        totalOrders: stats._count._all,
        totalSpent: money(stats._sum.grandTotal),
        outstanding: money(stats._sum.balanceDue),
        lastOrderAt: stats._max.createdAt,
      },
      openOrders: openOrders.map((o) => ({
        ...o,
        grandTotal: money(o.grandTotal),
        balanceDue: money(o.balanceDue),
        rack: o.rackAssignments[0]
          ? {
              slot: o.rackAssignments[0].rackSlot.code,
              rackName: o.rackAssignments[0].rackSlot.rack.name,
            }
          : null,
        rackAssignments: undefined,
      })),
    };
  }

  async create(ctx: AuthContext, input: CreateCustomerInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const phone = normalizePhone(input.phone);
    await this.assertPhoneAvailable(db, phone);
    if (input.priceListId) await this.assertPriceList(db, input.priceListId);

    const customer = await db.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId: ctx.tenantId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          phone,
          alternatePhone: input.alternatePhone ? normalizePhone(input.alternatePhone) : null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          priceListId: input.priceListId ?? null,
        },
      });
      if (input.address) {
        await tx.customerAddress.create({
          data: { ...addressData(input.address), tenantId: ctx.tenantId, customerId: created.id, isDefault: true },
        });
      }
      await this.audit.log(tx, ctx, {
        action: AuditAction.CUSTOMER_CREATED,
        entityType: 'Customer',
        entityId: created.id,
        metadata: { name: `${created.firstName} ${created.lastName ?? ''}`.trim(), phone },
      });
      return created;
    });
    return this.get(ctx, customer.id);
  }

  async update(ctx: AuthContext, id: string, input: UpdateCustomerInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const existing = await db.customer.findFirst({ where: { id } });
    if (!existing) throw notFound('Customer');

    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    if (phone && phone !== existing.phone) await this.assertPhoneAvailable(db, phone);
    if (input.priceListId) await this.assertPriceList(db, input.priceListId);

    const data: Prisma.CustomerUncheckedUpdateInput = {
      firstName: input.firstName,
      lastName: input.lastName,
      phone,
      alternatePhone: input.alternatePhone === undefined ? undefined : input.alternatePhone ? normalizePhone(input.alternatePhone) : null,
      email: input.email,
      notes: input.notes,
      priceListId: input.priceListId,
    };
    const changed = Object.entries(data)
      .filter(([k, v]) => v !== undefined && v !== (existing as Record<string, unknown>)[k])
      .map(([k]) => k);

    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data });
      await this.audit.log(tx, ctx, {
        action: AuditAction.CUSTOMER_UPDATED,
        entityType: 'Customer',
        entityId: id,
        metadata: { fields: changed },
      });
    });
    return this.get(ctx, id);
  }

  async addAddress(ctx: AuthContext, customerId: string, input: AddressInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const customer = await db.customer.findFirst({ where: { id: customerId }, include: { _count: { select: { addresses: true } } } });
    if (!customer) throw notFound('Customer');
    const makeDefault = input.isDefault || customer._count.addresses === 0;
    return db.$transaction(async (tx) => {
      if (makeDefault) await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      return tx.customerAddress.create({
        data: { ...addressData(input), tenantId: ctx.tenantId, customerId, isDefault: makeDefault },
      });
    });
  }

  async updateAddress(ctx: AuthContext, customerId: string, addressId: string, input: Partial<AddressInput>) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const address = await db.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!address) throw notFound('Address');
    return db.$transaction(async (tx) => {
      if (input.isDefault) await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      return tx.customerAddress.update({ where: { id: addressId }, data: addressData(input) });
    });
  }

  async removeAddress(ctx: AuthContext, customerId: string, addressId: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const address = await db.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!address) throw notFound('Address');
    await db.customerAddress.delete({ where: { id: addressId } });
    if (address.isDefault) {
      const next = await db.customerAddress.findFirst({ where: { customerId }, orderBy: { createdAt: 'asc' } });
      if (next) await db.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  async payments(ctx: AuthContext, customerId: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const payments = await db.payment.findMany({
      where: { customerId, ...storeScope(ctx) },
      orderBy: { receivedAt: 'desc' },
      take: 100,
      include: { order: { select: { id: true, orderNumber: true } }, receivedBy: { select: { name: true } } },
    });
    return payments.map((p) => ({ ...p, amount: money(p.amount) }));
  }

  private async assertPhoneAvailable(db: TenantDbOrTx, phone: string) {
    const existing = await db.customer.findFirst({ where: { phone }, select: { id: true, firstName: true, lastName: true } });
    if (existing) {
      throw conflict('DUPLICATE_PHONE', 'A customer with this phone number already exists.', {
        customerId: existing.id,
        name: [existing.firstName, existing.lastName].filter(Boolean).join(' '),
      });
    }
  }

  private async assertPriceList(db: TenantDbOrTx, id: string) {
    if (!(await db.priceList.findFirst({ where: { id } }))) throw notFound('Price list');
  }
}

function addressData<T extends Partial<AddressInput>>(input: T) {
  const { isDefault, latitude, longitude, ...rest } = input;
  return {
    ...rest,
    ...(isDefault !== undefined ? { isDefault } : {}),
    ...(latitude !== undefined ? { latitude: latitude === null ? null : String(latitude) } : {}),
    ...(longitude !== undefined ? { longitude: longitude === null ? null : String(longitude) } : {}),
  };
}

/** Tenant-scoped WHERE for customer search (phone digits or every word in name/email). */
export function customerSearchSql(tenantId: string, q?: string): Prisma.Sql {
  const base = Prisma.sql`c."tenantId" = ${tenantId}::uuid AND c."archivedAt" IS NULL`;
  const term = q?.trim();
  if (!term) return base;
  const digits = phoneDigits(term);
  if (digits.length >= 3 && /^[+\d\s\-()]+$/.test(term)) {
    return Prisma.sql`${base} AND (c.phone LIKE ${`%${digits}%`} OR c."alternatePhone" LIKE ${`%${digits}%`})`;
  }
  const words = term.split(/\s+/).filter(Boolean).slice(0, 4);
  const conditions = words.map((w) => {
    const like = `%${escapeLike(w)}%`;
    return Prisma.sql`(c."firstName" ILIKE ${like} OR c."lastName" ILIKE ${like} OR c.email ILIKE ${like})`;
  });
  return Prisma.sql`${base} AND ${Prisma.join(conditions, ' AND ')}`;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}
