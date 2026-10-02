import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  eachDayKey,
  moneyString,
  ORDER_STATUS_LABEL,
  OrderStatus,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  PaymentMethod,
  ReportQuery,
  ReportType,
  resolvePresetKeys,
  sumMoney,
  toDecimal,
  zonedRange,
} from '@rinseops/shared';
import { AuthContext, storeIdsForSql } from '../../common/auth/auth-context';
import { PrismaService } from '../../common/prisma/prisma.service';
import { money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { localDaySql, num, storeFilterSql } from './sql-helpers';

export type ColumnType = 'text' | 'money' | 'number' | 'date' | 'datetime' | 'percent';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface ReportSummaryItem {
  label: string;
  value: string | number;
  type: ColumnType;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  range: { from: string; to: string; timezone: string };
  currency: string;
  summary: ReportSummaryItem[];
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
}

interface ReportContext {
  tenantId: string;
  storeIds: string[] | null;
  tz: string;
  from: string;
  to: string;
  start: Date;
  end: Date;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * Operational reports built directly on PostgreSQL aggregates (no warehouse).
 * Every query filters by tenantId explicitly because raw SQL bypasses the
 * tenant-scoping Prisma extension.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async run(ctx: AuthContext, type: ReportType, query: ReportQuery): Promise<ReportResult> {
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const tz = settings.timezone;
    const { from, to } = resolvePresetKeys(query.preset, tz, { from: query.from, to: query.to });
    const { start, end } = zonedRange(from, to, tz);
    const rc: ReportContext = { tenantId: ctx.tenantId, storeIds: storeIdsForSql(ctx, query.storeId), tz, from, to, start, end };

    const base = { range: { from, to, timezone: tz }, currency: settings.currency };
    switch (type) {
      case 'sales':
        return { ...base, ...(await this.sales(rc)) };
      case 'orders':
        return { ...base, ...(await this.orders(rc)) };
      case 'payments':
        return { ...base, ...(await this.payments(rc)) };
      case 'outstanding':
        return { ...base, ...(await this.outstanding(rc)) };
      case 'services':
        return { ...base, ...(await this.services(rc)) };
      case 'customers':
        return { ...base, ...(await this.customers(rc)) };
    }
  }

  toCsv(report: ReportResult): string {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      report.columns.map((c) => escape(c.label)).join(','),
      ...report.rows.map((r) => report.columns.map((c) => escape(r[c.key])).join(',')),
    ];
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  // -------------------------------------------------------------------------

  private async sales(rc: ReportContext) {
    const orderDay = localDaySql('o."createdAt"', rc.tz);
    const payDay = localDaySql('p."receivedAt"', rc.tz);
    const [orderRows, paymentRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          day: string;
          orders: bigint;
          pieces: bigint;
          gross: Prisma.Decimal;
          discount: Prisma.Decimal;
          tax: Prisma.Decimal;
          net: Prisma.Decimal;
        }>
      >`
        SELECT ${orderDay} AS day, count(*) AS orders, sum(o."totalPieces") AS pieces,
               sum(o.subtotal) AS gross, sum(o."discountAmount") AS discount,
               sum(o."taxAmount") AS tax, sum(o."grandTotal") AS net
        FROM "Order" o
        WHERE o."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED'
          AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'o')}
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ day: string; collected: Prisma.Decimal }>>`
        SELECT ${payDay} AS day, sum(p.amount) AS collected
        FROM "Payment" p
        WHERE p."tenantId" = ${rc.tenantId}::uuid AND p.status = 'COMPLETED'
          AND p."receivedAt" >= ${rc.start} AND p."receivedAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'p')}
        GROUP BY 1`,
    ]);
    const om = new Map(orderRows.map((r) => [r.day, r]));
    const pm = new Map(paymentRows.map((r) => [r.day, r]));
    const rows = eachDayKey(rc.from, rc.to).map((day) => {
      const o = om.get(day);
      return {
        date: day,
        orders: num(o?.orders),
        pieces: num(o?.pieces),
        gross: money(o?.gross),
        discount: money(o?.discount),
        tax: money(o?.tax),
        net: money(o?.net),
        collected: money(pm.get(day)?.collected),
      };
    });
    const totalOrders = rows.reduce((a, r) => a + r.orders, 0);
    const net = sumMoney(rows.map((r) => r.net));
    return {
      type: 'sales' as const,
      title: 'Sales summary',
      summary: [
        { label: 'Net sales', value: net, type: 'money' as const },
        { label: 'Orders', value: totalOrders, type: 'number' as const },
        {
          label: 'Average order value',
          value: totalOrders ? moneyString(toDecimal(net).dividedBy(totalOrders)) : '0.00',
          type: 'money' as const,
        },
        { label: 'Discounts given', value: sumMoney(rows.map((r) => r.discount)), type: 'money' as const },
        { label: 'Tax', value: sumMoney(rows.map((r) => r.tax)), type: 'money' as const },
        { label: 'Collected', value: sumMoney(rows.map((r) => r.collected)), type: 'money' as const },
      ],
      columns: [
        { key: 'date', label: 'Date', type: 'date' as const },
        { key: 'orders', label: 'Orders', type: 'number' as const },
        { key: 'pieces', label: 'Pieces', type: 'number' as const },
        { key: 'gross', label: 'Gross', type: 'money' as const },
        { key: 'discount', label: 'Discount', type: 'money' as const },
        { key: 'tax', label: 'Tax', type: 'money' as const },
        { key: 'net', label: 'Net sales', type: 'money' as const },
        { key: 'collected', label: 'Collected', type: 'money' as const },
      ],
      rows,
    };
  }

  private async orders(rc: ReportContext) {
    const [byStatus, perf, byStore] = await Promise.all([
      this.prisma.$queryRaw<Array<{ status: OrderStatus; orders: bigint; value: Prisma.Decimal }>>`
        SELECT o.status, count(*) AS orders, sum(o."grandTotal") AS value
        FROM "Order" o
        WHERE o."tenantId" = ${rc.tenantId}::uuid
          AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'o')}
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ readyCount: bigint; onTime: bigint; avgHours: number | null; homeDelivery: bigint }>>`
        SELECT count(o."readyAt") AS "readyCount",
               count(*) FILTER (WHERE o."readyAt" IS NOT NULL AND o."readyAt" <= o."dueDate") AS "onTime",
               avg(EXTRACT(EPOCH FROM (o."readyAt" - o."createdAt")) / 3600) FILTER (WHERE o."readyAt" IS NOT NULL) AS "avgHours",
               count(*) FILTER (WHERE o."deliveryMode" = 'HOME_DELIVERY' AND o.status <> 'CANCELLED') AS "homeDelivery"
        FROM "Order" o
        WHERE o."tenantId" = ${rc.tenantId}::uuid
          AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'o')}`,
      this.prisma.$queryRaw<Array<{ store: string; orders: bigint }>>`
        SELECT s.name AS store, count(*) AS orders
        FROM "Order" o JOIN "Store" s ON s.id = o."storeId"
        WHERE o."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED'
          AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'o')}
        GROUP BY 1 ORDER BY 2 DESC`,
    ]);
    const total = byStatus.reduce((a, r) => a + num(r.orders), 0);
    const order: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'CANCELLED'];
    const rows = order.map((status) => {
      const r = byStatus.find((b) => b.status === status);
      return {
        status: ORDER_STATUS_LABEL[status],
        orders: num(r?.orders),
        value: money(r?.value),
        share: pct(num(r?.orders), total),
      };
    });
    const p = perf[0];
    const readyCount = num(p?.readyCount);
    return {
      type: 'orders' as const,
      title: 'Orders summary',
      summary: [
        { label: 'Orders received', value: total, type: 'number' as const },
        { label: 'Delivered', value: num(byStatus.find((b) => b.status === 'DELIVERED')?.orders), type: 'number' as const },
        { label: 'Cancelled', value: num(byStatus.find((b) => b.status === 'CANCELLED')?.orders), type: 'number' as const },
        { label: 'Ready on time', value: pct(num(p?.onTime), readyCount), type: 'percent' as const },
        { label: 'Avg. turnaround (hrs)', value: p?.avgHours ? Math.round(Number(p.avgHours) * 10) / 10 : 0, type: 'number' as const },
        { label: 'Home deliveries', value: num(p?.homeDelivery), type: 'number' as const },
        ...byStore.map((s) => ({ label: `Orders · ${s.store}`, value: num(s.orders), type: 'number' as const })),
      ],
      columns: [
        { key: 'status', label: 'Status', type: 'text' as const },
        { key: 'orders', label: 'Orders', type: 'number' as const },
        { key: 'value', label: 'Order value', type: 'money' as const },
        { key: 'share', label: 'Share', type: 'percent' as const },
      ],
      rows,
    };
  }

  private async payments(rc: ReportContext) {
    const [byMethod, refunds] = await Promise.all([
      this.prisma.$queryRaw<Array<{ method: PaymentMethod; count: bigint; amount: Prisma.Decimal }>>`
        SELECT p.method, count(*) AS count, sum(p.amount) AS amount
        FROM "Payment" p
        WHERE p."tenantId" = ${rc.tenantId}::uuid AND p.status = 'COMPLETED'
          AND p."receivedAt" >= ${rc.start} AND p."receivedAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'p')}
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ count: bigint; amount: Prisma.Decimal | null }>>`
        SELECT count(*) AS count, sum(p.amount) AS amount
        FROM "Payment" p
        WHERE p."tenantId" = ${rc.tenantId}::uuid AND p.status = 'REFUNDED'
          AND p."refundedAt" >= ${rc.start} AND p."refundedAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'p')}`,
    ]);
    const total = sumMoney(byMethod.map((m) => m.amount.toString()));
    const rows = PAYMENT_METHODS.map((method) => {
      const r = byMethod.find((b) => b.method === method);
      return {
        method: PAYMENT_METHOD_LABEL[method],
        payments: num(r?.count),
        amount: money(r?.amount),
        share: pct(Number(r?.amount ?? 0), Number(total)),
      };
    });
    return {
      type: 'payments' as const,
      title: 'Payment summary',
      summary: [
        { label: 'Total collected', value: total, type: 'money' as const },
        ...rows.map((r) => ({ label: r.method, value: r.amount, type: 'money' as const })),
        { label: 'Refunded', value: money(refunds[0]?.amount), type: 'money' as const },
      ],
      columns: [
        { key: 'method', label: 'Method', type: 'text' as const },
        { key: 'payments', label: 'Payments', type: 'number' as const },
        { key: 'amount', label: 'Amount', type: 'money' as const },
        { key: 'share', label: 'Share', type: 'percent' as const },
      ],
      rows,
    };
  }

  /** Point-in-time: every open balance today, regardless of the date range. */
  private async outstanding(rc: ReportContext) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        orderNumber: string;
        customer: string;
        phone: string;
        createdAt: Date;
        dueDate: Date;
        status: OrderStatus;
        grandTotal: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        balanceDue: Prisma.Decimal;
        ageDays: number;
      }>
    >`
      SELECT o."orderNumber", trim(c."firstName" || ' ' || coalesce(c."lastName", '')) AS customer, c.phone,
             o."createdAt", o."dueDate", o.status, o."grandTotal", o."paidAmount", o."balanceDue",
             floor(EXTRACT(EPOCH FROM (now() - o."createdAt")) / 86400)::int AS "ageDays"
      FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
      WHERE o."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED' AND o."balanceDue" > 0
        ${storeFilterSql(rc.storeIds, 'o')}
      ORDER BY o."balanceDue" DESC, o."createdAt" ASC
      LIMIT 1000`;
    const bucket = (min: number, max: number) =>
      sumMoney(rows.filter((r) => r.ageDays >= min && r.ageDays <= max).map((r) => r.balanceDue.toString()));
    return {
      type: 'outstanding' as const,
      title: 'Outstanding payments',
      summary: [
        { label: 'Total outstanding', value: sumMoney(rows.map((r) => r.balanceDue.toString())), type: 'money' as const },
        { label: 'Orders with balance', value: rows.length, type: 'number' as const },
        { label: '0–7 days', value: bucket(0, 7), type: 'money' as const },
        { label: '8–30 days', value: bucket(8, 30), type: 'money' as const },
        { label: 'Over 30 days', value: bucket(31, Number.MAX_SAFE_INTEGER), type: 'money' as const },
      ],
      columns: [
        { key: 'orderNumber', label: 'Order #', type: 'text' as const },
        { key: 'customer', label: 'Customer', type: 'text' as const },
        { key: 'phone', label: 'Phone', type: 'text' as const },
        { key: 'createdAt', label: 'Order date', type: 'datetime' as const },
        { key: 'status', label: 'Status', type: 'text' as const },
        { key: 'grandTotal', label: 'Total', type: 'money' as const },
        { key: 'paidAmount', label: 'Paid', type: 'money' as const },
        { key: 'balanceDue', label: 'Balance', type: 'money' as const },
        { key: 'ageDays', label: 'Age (days)', type: 'number' as const },
      ],
      rows: rows.map((r) => ({
        orderNumber: r.orderNumber,
        customer: r.customer,
        phone: r.phone,
        createdAt: r.createdAt.toISOString(),
        status: ORDER_STATUS_LABEL[r.status],
        grandTotal: money(r.grandTotal),
        paidAmount: money(r.paidAmount),
        balanceDue: money(r.balanceDue),
        ageDays: r.ageDays,
      })),
    };
  }

  private async services(rc: ReportContext) {
    const rows = await this.prisma.$queryRaw<
      Array<{ category: string; item: string; unitType: string; quantity: Prisma.Decimal; orders: bigint; revenue: Prisma.Decimal }>
    >`
      SELECT l."categoryName" AS category, l."itemName" AS item, l."unitType" AS "unitType",
             sum(l.quantity) AS quantity, count(DISTINCT l."orderId") AS orders, sum(l."lineTotal") AS revenue
      FROM "OrderLine" l JOIN "Order" o ON o.id = l."orderId"
      WHERE l."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED'
        AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
        ${storeFilterSql(rc.storeIds, 'o')}
      GROUP BY 1, 2, 3
      ORDER BY revenue DESC`;
    const total = sumMoney(rows.map((r) => r.revenue.toString()));
    const byCategory = new Map<string, string>();
    for (const r of rows) byCategory.set(r.category, sumMoney([byCategory.get(r.category) ?? '0', r.revenue.toString()]));
    const topCategories = [...byCategory.entries()].sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 4);
    return {
      type: 'services' as const,
      title: 'Service performance',
      summary: [
        { label: 'Service revenue', value: total, type: 'money' as const },
        ...topCategories.map(([name, value]) => ({ label: name, value, type: 'money' as const })),
      ],
      columns: [
        { key: 'category', label: 'Service', type: 'text' as const },
        { key: 'item', label: 'Item', type: 'text' as const },
        { key: 'quantity', label: 'Quantity', type: 'number' as const },
        { key: 'orders', label: 'Orders', type: 'number' as const },
        { key: 'revenue', label: 'Revenue', type: 'money' as const },
        { key: 'share', label: 'Share', type: 'percent' as const },
      ],
      rows: rows.map((r) => ({
        category: r.category,
        item: r.item,
        quantity: `${Number(r.quantity)}${r.unitType === 'KG' ? ' kg' : ''}`,
        orders: num(r.orders),
        revenue: money(r.revenue),
        share: pct(Number(r.revenue), Number(total)),
      })),
    };
  }

  private async customers(rc: ReportContext) {
    const [rows, stats] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          name: string;
          phone: string;
          orders: bigint;
          spent: Prisma.Decimal;
          paid: Prisma.Decimal;
          balance: Prisma.Decimal;
          lastOrder: Date;
        }>
      >`
        SELECT trim(c."firstName" || ' ' || coalesce(c."lastName", '')) AS name, c.phone,
               count(*) AS orders, sum(o."grandTotal") AS spent, sum(o."paidAmount") AS paid,
               sum(o."balanceDue") AS balance, max(o."createdAt") AS "lastOrder"
        FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
        WHERE o."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED'
          AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
          ${storeFilterSql(rc.storeIds, 'o')}
        GROUP BY c.id
        ORDER BY spent DESC
        LIMIT 100`,
      this.prisma.$queryRaw<Array<{ active: bigint; newCustomers: bigint; returning: bigint }>>`
        WITH active AS (
          SELECT DISTINCT o."customerId"
          FROM "Order" o
          WHERE o."tenantId" = ${rc.tenantId}::uuid AND o.status <> 'CANCELLED'
            AND o."createdAt" >= ${rc.start} AND o."createdAt" < ${rc.end}
            ${storeFilterSql(rc.storeIds, 'o')}
        )
        SELECT
          (SELECT count(*) FROM active) AS active,
          (SELECT count(*) FROM "Customer" c WHERE c."tenantId" = ${rc.tenantId}::uuid
             AND c."createdAt" >= ${rc.start} AND c."createdAt" < ${rc.end}) AS "newCustomers",
          (SELECT count(*) FROM active a WHERE EXISTS (
             SELECT 1 FROM "Order" o2 WHERE o2."tenantId" = ${rc.tenantId}::uuid
               AND o2."customerId" = a."customerId" AND o2."createdAt" < ${rc.start} AND o2.status <> 'CANCELLED')) AS returning`,
    ]);
    const s = stats[0];
    const totalSpent = sumMoney(rows.map((r) => r.spent.toString()));
    return {
      type: 'customers' as const,
      title: 'Customer summary',
      summary: [
        { label: 'Active customers', value: num(s?.active), type: 'number' as const },
        { label: 'New customers', value: num(s?.newCustomers), type: 'number' as const },
        { label: 'Returning customers', value: num(s?.returning), type: 'number' as const },
        {
          label: 'Avg. spend per customer',
          value: rows.length ? moneyString(toDecimal(totalSpent).dividedBy(rows.length)) : '0.00',
          type: 'money' as const,
        },
      ],
      columns: [
        { key: 'name', label: 'Customer', type: 'text' as const },
        { key: 'phone', label: 'Phone', type: 'text' as const },
        { key: 'orders', label: 'Orders', type: 'number' as const },
        { key: 'spent', label: 'Spent', type: 'money' as const },
        { key: 'paid', label: 'Paid', type: 'money' as const },
        { key: 'balance', label: 'Balance', type: 'money' as const },
        { key: 'lastOrder', label: 'Last order', type: 'datetime' as const },
      ],
      rows: rows.map((r) => ({
        name: r.name,
        phone: r.phone,
        orders: num(r.orders),
        spent: money(r.spent),
        paid: money(r.paid),
        balance: money(r.balance),
        lastOrder: r.lastOrder.toISOString(),
      })),
    };
  }
}
