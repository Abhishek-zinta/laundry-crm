import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifySearch, OPEN_ORDER_STATUSES, Permission, phoneDigits, SearchQuery } from '@rinseops/shared';
import { AuthContext, hasPermission, storeScope } from '../../common/auth/auth-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { money } from '../../common/util/serialize';
import { ORDER_LIST_SELECT, rackLocation, serializeOrderListRow } from '../orders/order-serializer';

/**
 * Global search used by Cmd/Ctrl+K and the counter. Detects what was typed
 * (phone, order number, tag, name) and returns customers, orders and garments,
 * with rack location and balance so staff can act immediately.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ctx: AuthContext, { q, limit }: SearchQuery) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const kind = classifySearch(q);
    const term = q.trim();
    const upper = term.toUpperCase();
    const canCustomers = hasPermission(ctx, Permission.CUSTOMERS_VIEW);
    const canOrders = hasPermission(ctx, Permission.ORDERS_VIEW);
    const canGarments = hasPermission(ctx, Permission.GARMENTS_VIEW);
    const scope = storeScope(ctx);

    // 1. Customers
    let customers: Array<{ id: string; firstName: string; lastName: string | null; phone: string; email: string | null }> = [];
    if (canCustomers && (kind === 'phone' || kind === 'text')) {
      const where: Prisma.CustomerWhereInput =
        kind === 'phone'
          ? { archivedAt: null, OR: [{ phone: { contains: phoneDigits(term) } }, { alternatePhone: { contains: phoneDigits(term) } }] }
          : {
              archivedAt: null,
              AND: term
                .split(/\s+/)
                .slice(0, 4)
                .map((w) => ({
                  OR: [
                    { firstName: { contains: w, mode: 'insensitive' as const } },
                    { lastName: { contains: w, mode: 'insensitive' as const } },
                    { email: { contains: w, mode: 'insensitive' as const } },
                  ],
                })),
            };
      customers = await db.customer.findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      });
    }
    const customerIds = customers.map((c) => c.id);

    // 2. Orders
    let orders: ReturnType<typeof serializeOrderListRow>[] = [];
    if (canOrders) {
      const or: Prisma.OrderWhereInput[] = [];
      if (kind === 'order') or.push({ orderNumber: upper });
      if (kind === 'tag') or.push({ garments: { some: { tagCode: upper } } }, { orderNumber: { contains: upper } });
      if (kind === 'text' || kind === 'phone') or.push({ orderNumber: { contains: term, mode: 'insensitive' } });
      if (customerIds.length) or.push({ customerId: { in: customerIds } });
      if (or.length) {
        const rows = await db.order.findMany({
          where: { AND: [scope, { OR: or }] },
          select: ORDER_LIST_SELECT,
          orderBy: [{ createdAt: 'desc' }],
          take: Math.max(limit, 10),
        });
        // Open orders first: they are what the counter usually needs.
        const open = OPEN_ORDER_STATUSES as readonly string[];
        orders = rows
          .sort((a, b) => Number(open.includes(b.status)) - Number(open.includes(a.status)))
          .slice(0, limit)
          .map(serializeOrderListRow);
      }
    }

    // 3. Garments
    let garments: unknown[] = [];
    if (canGarments) {
      const where: Prisma.GarmentUnitWhereInput | null =
        kind === 'tag'
          ? { tagCode: { startsWith: upper } }
          : customerIds.length
            ? { order: { customerId: { in: customerIds }, status: { in: [...OPEN_ORDER_STATUSES] } } }
            : kind === 'order'
              ? { order: { orderNumber: upper } }
              : null;
      if (where) {
        const rows = await db.garmentUnit.findMany({
          where: { AND: [where, { order: scope }] },
          take: limit,
          orderBy: { tagCode: 'asc' },
          include: {
            orderLine: { select: { description: true } },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                balanceDue: true,
                customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
                rackAssignments: {
                  where: { removedAt: null },
                  select: { rackSlot: { select: { id: true, code: true, rack: { select: { id: true, name: true, code: true } } } } },
                },
              },
            },
          },
        });
        garments = rows.map((g) => ({
          id: g.id,
          tagCode: g.tagCode,
          status: g.status,
          color: g.color,
          description: g.orderLine.description,
          order: {
            id: g.order.id,
            orderNumber: g.order.orderNumber,
            status: g.order.status,
            balanceDue: money(g.order.balanceDue),
            customer: g.order.customer,
            rack: rackLocation(g.order.rackAssignments[0]?.rackSlot),
          },
        }));
      }
    }

    // Customer summaries (outstanding + open orders) for the counter view.
    const customerSummaries = customerIds.length
      ? await db.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: customerIds }, status: { not: 'CANCELLED' } },
          _sum: { balanceDue: true },
          _count: { _all: true },
        })
      : [];
    const summaryMap = new Map(customerSummaries.map((s) => [s.customerId, s]));

    return {
      query: term,
      kind,
      customers: customers.map((c) => ({
        ...c,
        totalOrders: summaryMap.get(c.id)?._count._all ?? 0,
        outstanding: money(summaryMap.get(c.id)?._sum.balanceDue),
      })),
      orders,
      garments,
    };
  }
}
