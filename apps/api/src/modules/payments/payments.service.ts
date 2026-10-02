import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  CreatePaymentInput,
  formatMoney,
  PAYMENT_METHODS,
  PaymentListQuery,
  phoneDigits,
  RefundPaymentInput,
  sumMoney,
  toDecimal,
  zonedRange,
} from '@rinseops/shared';
import { AuthContext, assertStoreAccess, storeScope } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, notFound, unprocessable } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { lockOrder, recalcOrderPayments } from './ledger';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Records a payment against an order (supports partial payments). */
  async record(ctx: AuthContext, input: CreatePaymentInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const fmt = (v: { toString(): string }) => formatMoney(v.toString(), settings.currency, settings.locale);

    if (input.idempotencyKey) {
      const existing = await db.payment.findFirst({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return this.serialize(existing, await this.orderSummary(ctx, existing.orderId));
    }

    const payment = await db.$transaction(async (tx) => {
      if (!(await lockOrder(tx, ctx.tenantId, input.orderId))) throw notFound('Order');
      const order = await tx.order.findFirstOrThrow({ where: { id: input.orderId } });
      assertStoreAccess(ctx, order.storeId);

      if (order.status === 'CANCELLED') {
        throw new AppError(
          'ORDER_ALREADY_CANCELLED',
          "This order was cancelled, so it can't take payments.",
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const balance = toDecimal(order.balanceDue.toString());
      if (balance.lessThanOrEqualTo(0)) {
        throw unprocessable('ORDER_FULLY_PAID', 'This order is already fully paid.');
      }
      if (toDecimal(input.amount).greaterThan(balance)) {
        throw unprocessable('PAYMENT_EXCEEDS_BALANCE', `The amount is more than the outstanding balance of ${fmt(order.balanceDue)}.`, {
          balanceDue: money(order.balanceDue),
        });
      }

      const created = await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          orderId: order.id,
          storeId: order.storeId,
          customerId: order.customerId,
          amount: input.amount,
          method: input.method,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          status: 'COMPLETED',
          receivedById: ctx.userId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      const after = await recalcOrderPayments(tx, order.id);
      await this.audit.log(tx, ctx, {
        action: AuditAction.PAYMENT_RECORDED,
        entityType: 'Order',
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          paymentId: created.id,
          amount: input.amount,
          method: input.method,
          balanceAfter: money(after.balanceDue),
        },
      });
      return created;
    });
    return this.serialize(payment, await this.orderSummary(ctx, payment.orderId));
  }

  /** Marks a completed payment as refunded; the ledger row is kept. */
  async refund(ctx: AuthContext, paymentId: string, input: RefundPaymentInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const existing = await db.payment.findFirst({ where: { id: paymentId } });
    if (!existing) throw notFound('Payment');
    assertStoreAccess(ctx, existing.storeId);

    const payment = await db.$transaction(async (tx) => {
      await lockOrder(tx, ctx.tenantId, existing.orderId);
      const current = await tx.payment.findFirstOrThrow({
        where: { id: paymentId },
        include: { order: { select: { orderNumber: true } } },
      });
      if (current.status === 'REFUNDED') throw unprocessable('PAYMENT_ALREADY_REFUNDED', 'This payment has already been refunded.');
      if (current.status !== 'COMPLETED') throw unprocessable('PAYMENT_NOT_REFUNDABLE', 'Only completed payments can be refunded.');

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED', refundedAt: new Date(), refundedById: ctx.userId, refundReason: input.reason },
      });
      await recalcOrderPayments(tx, current.orderId);
      await this.audit.log(tx, ctx, {
        action: AuditAction.PAYMENT_REFUNDED,
        entityType: 'Order',
        entityId: current.orderId,
        metadata: { orderNumber: current.order.orderNumber, paymentId, amount: money(current.amount), reason: input.reason },
      });
      return updated;
    });
    return this.serialize(payment, await this.orderSummary(ctx, payment.orderId));
  }

  async list(ctx: AuthContext, query: PaymentListQuery) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const where = this.listWhere(ctx, query, settings.timezone);

    const [rows, total, byMethod] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          order: { select: { id: true, orderNumber: true } },
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          store: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, name: true } },
        },
      }),
      db.payment.count({ where }),
      db.payment.groupBy({
        by: ['method'],
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const summary = PAYMENT_METHODS.map((method) => {
      const row = byMethod.find((b) => b.method === method);
      return { method, amount: money(row?._sum.amount), count: row?._count._all ?? 0 };
    });
    return {
      items: rows.map((p) => ({ ...p, amount: money(p.amount) })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        byMethod: summary,
        totalCollected: sumMoney(summary.map((s) => s.amount)),
      },
    };
  }

  private listWhere(ctx: AuthContext, query: PaymentListQuery, timeZone: string): Prisma.PaymentWhereInput {
    const and: Prisma.PaymentWhereInput[] = [storeScope(ctx, query.storeId)];
    if (query.method) and.push({ method: query.method });
    if (query.status) and.push({ status: query.status });
    if (query.from || query.to) {
      const range = zonedRange(query.from ?? query.to!, query.to ?? query.from!, timeZone);
      and.push({ receivedAt: { gte: range.start, lt: range.end } });
    }
    if (query.q) {
      const digits = phoneDigits(query.q);
      and.push({
        OR: [
          { order: { orderNumber: { contains: query.q, mode: 'insensitive' } } },
          { reference: { contains: query.q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
          { customer: { firstName: { contains: query.q, mode: 'insensitive' } } },
          { customer: { lastName: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }
    return { AND: and };
  }

  private async orderSummary(ctx: AuthContext, orderId: string) {
    const order = await this.prisma.forTenant(ctx.tenantId).order.findFirstOrThrow({
      where: { id: orderId },
      select: { id: true, orderNumber: true, grandTotal: true, paidAmount: true, balanceDue: true, paymentStatus: true },
    });
    return {
      ...order,
      grandTotal: money(order.grandTotal),
      paidAmount: money(order.paidAmount),
      balanceDue: money(order.balanceDue),
    };
  }

  private serialize<T extends { amount: Prisma.Decimal }>(payment: T, order: Awaited<ReturnType<PaymentsService['orderSummary']>>) {
    return { ...payment, amount: money(payment.amount), order };
  }
}
