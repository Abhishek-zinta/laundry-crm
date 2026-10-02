import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addDaysToKey,
  dateKeyInZone,
  eachDayKey,
  OPEN_ORDER_STATUSES,
  OPEN_TASK_STATUSES,
  OrderStatus,
  PENDING_ORDER_STATUSES,
  zonedDayRange,
  zonedRange,
} from '@rinseops/shared';
import { AuthContext, storeIdsForSql, storeScope } from '../../common/auth/auth-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateFromKey, money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { ORDER_LIST_SELECT, serializeOrderListRow } from '../orders/order-serializer';
import { localDaySql, storeFilterSql } from '../reports/sql-helpers';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(ctx: AuthContext, storeId?: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const tz = settings.timezone;
    const now = new Date();
    const todayKey = dateKeyInZone(now, tz);
    const today = zonedDayRange(todayKey, tz);
    const scope = storeScope(ctx, storeId);
    const storeIds = storeIdsForSql(ctx, storeId);
    const notCancelled = { status: { not: OrderStatus.CANCELLED } };

    const [
      collectedToday,
      salesToday,
      pending,
      ready,
      unpaid,
      customersToday,
      newCustomersToday,
      statusGroups,
      deliveredToday,
      recentOrders,
      recentPayments,
      dueToday,
      overdue,
      overdueCount,
      tasksToday,
      trendRows,
    ] = await Promise.all([
      db.payment.aggregate({
        where: { ...scope, status: 'COMPLETED', receivedAt: { gte: today.start, lt: today.end } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      db.order.aggregate({
        where: { ...scope, ...notCancelled, createdAt: { gte: today.start, lt: today.end } },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      db.order.count({ where: { ...scope, status: { in: [...PENDING_ORDER_STATUSES] } } }),
      db.order.count({ where: { ...scope, status: OrderStatus.READY } }),
      db.order.aggregate({
        where: { ...scope, ...notCancelled, balanceDue: { gt: 0 } },
        _sum: { balanceDue: true },
        _count: { _all: true },
      }),
      db.order.findMany({
        where: { ...scope, ...notCancelled, createdAt: { gte: today.start, lt: today.end } },
        distinct: ['customerId'],
        select: { customerId: true },
      }),
      db.customer.count({ where: { createdAt: { gte: today.start, lt: today.end } } }),
      db.order.groupBy({ by: ['status'], where: { ...scope, status: { in: [...OPEN_ORDER_STATUSES] } }, _count: { _all: true } }),
      db.order.count({ where: { ...scope, status: OrderStatus.DELIVERED, deliveredAt: { gte: today.start, lt: today.end } } }),
      db.order.findMany({ where: scope, select: ORDER_LIST_SELECT, orderBy: { createdAt: 'desc' }, take: 8 }),
      db.payment.findMany({
        where: { ...scope, status: 'COMPLETED' },
        orderBy: { receivedAt: 'desc' },
        take: 8,
        include: {
          order: { select: { id: true, orderNumber: true } },
          customer: { select: { id: true, firstName: true, lastName: true } },
          receivedBy: { select: { name: true } },
        },
      }),
      db.order.findMany({
        where: { ...scope, status: { in: [...OPEN_ORDER_STATUSES] }, dueDate: { gte: today.start, lt: today.end } },
        select: ORDER_LIST_SELECT,
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      db.order.findMany({
        where: { ...scope, status: { in: [...PENDING_ORDER_STATUSES] }, dueDate: { lt: now } },
        select: ORDER_LIST_SELECT,
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      db.order.count({ where: { ...scope, status: { in: [...PENDING_ORDER_STATUSES] }, dueDate: { lt: now } } }),
      db.pickupDeliveryTask.groupBy({
        by: ['type'],
        where: { ...scope, scheduledDate: dateFromKey(todayKey), status: { in: [...OPEN_TASK_STATUSES] } },
        _count: { _all: true },
      }),
      this.collectionsTrend(ctx.tenantId, storeIds, tz, addDaysToKey(todayKey, -6), todayKey),
    ]);

    const counts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;

    return {
      date: todayKey,
      currency: settings.currency,
      metrics: {
        revenueToday: money(collectedToday._sum.amount),
        paymentsToday: collectedToday._count._all,
        salesToday: money(salesToday._sum.grandTotal),
        ordersToday: salesToday._count._all,
        pendingOrders: pending,
        readyOrders: ready,
        unpaidAmount: money(unpaid._sum.balanceDue),
        unpaidOrders: unpaid._count._all,
        customersToday: customersToday.length,
        newCustomersToday,
        overdueOrders: overdueCount,
        pickupsToday: tasksToday.find((t) => t.type === 'PICKUP')?._count._all ?? 0,
        deliveriesToday: tasksToday.find((t) => t.type === 'DELIVERY')?._count._all ?? 0,
      },
      statusCounts: {
        RECEIVED: counts.RECEIVED ?? 0,
        PROCESSING: counts.PROCESSING ?? 0,
        QUALITY_CHECK: counts.QUALITY_CHECK ?? 0,
        READY: counts.READY ?? 0,
        DELIVERED: deliveredToday,
      },
      recentOrders: recentOrders.map(serializeOrderListRow),
      recentPayments: recentPayments.map((p) => ({ ...p, amount: money(p.amount) })),
      dueToday: dueToday.map(serializeOrderListRow),
      overdue: overdue.map(serializeOrderListRow),
      trend: trendRows,
    };
  }

  private async collectionsTrend(tenantId: string, storeIds: string[] | null, tz: string, from: string, to: string) {
    const range = zonedRange(from, to, tz);
    const day = localDaySql('p."receivedAt"', tz);
    const rows = await this.prisma.$queryRaw<Array<{ day: string; amount: Prisma.Decimal }>>`
      SELECT ${day} AS day, sum(p.amount) AS amount
      FROM "Payment" p
      WHERE p."tenantId" = ${tenantId}::uuid AND p.status = 'COMPLETED'
        AND p."receivedAt" >= ${range.start} AND p."receivedAt" < ${range.end}
        ${storeFilterSql(storeIds, 'p')}
      GROUP BY 1`;
    const map = new Map(rows.map((r) => [r.day, money(r.amount)]));
    return eachDayKey(from, to).map((d) => ({ date: d, amount: map.get(d) ?? '0.00' }));
  }
}
