import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  calculateOrderTotals,
  classifySearch,
  CreateOrderInput,
  dateKeyInZone,
  DiscountInput,
  formatMoney,
  formatOrderNumber,
  formatTagCode,
  garmentUnitsForLine,
  nextOrderStage,
  OPEN_ORDER_STATUSES,
  OrderLineInput,
  OrderListQuery,
  OrderStatus,
  PENDING_ORDER_STATUSES,
  Permission,
  phoneDigits,
  priceModifier,
  PricingResult,
  roundMoney,
  sumMoney,
  toDecimal,
  UpdateOrderInput,
  zonedDayRange,
  zonedRange,
} from '@rinseops/shared';
import { randomUUID } from 'node:crypto';
import { AuthContext, assertPermission, assertStoreAccess, hasPermission, storeScope } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, badRequest, notFound, unprocessable } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantTx } from '../../common/prisma/tenant-extension';
import { reserveSequence } from '../../common/util/counters';
import { money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { PricingService, ResolvedLine } from '../catalog/pricing.service';
import { lockOrder, recalcOrderPayments } from '../payments/ledger';
import { WorkflowService } from '../workflow/workflow.service';
import { ORDER_DETAIL_INCLUDE, ORDER_LIST_SELECT, serializeOrderDetail, serializeOrderListRow } from './order-serializer';

type Settings = Awaited<ReturnType<typeof loadTenantSettings>>;

const SORT_FIELDS: Record<OrderListQuery['sort'], keyof Prisma.OrderOrderByWithRelationInput> = {
  createdAt: 'createdAt',
  dueDate: 'dueDate',
  orderNumber: 'orderNumber',
  grandTotal: 'grandTotal',
  balanceDue: 'balanceDue',
  status: 'status',
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
    private readonly workflow: WorkflowService,
  ) {}

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(ctx: AuthContext, input: CreateOrderInput) {
    assertStoreAccess(ctx, input.storeId);
    const db = this.prisma.forTenant(ctx.tenantId);

    if (input.idempotencyKey) {
      const existing = await db.order.findFirst({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
      if (existing) return this.get(ctx, existing.id);
    }
    if (input.discount && toDecimal(input.discount.value).greaterThan(0)) {
      assertPermission(ctx, Permission.ORDERS_DISCOUNT, "You don't have permission to give discounts.");
    }
    if (input.payments.length) assertPermission(ctx, Permission.PAYMENTS_CREATE);

    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const [store, customer] = await Promise.all([
      db.store.findFirst({ where: { id: input.storeId, isActive: true } }),
      db.customer.findFirst({ where: { id: input.customerId, archivedAt: null } }),
    ]);
    if (!store) throw notFound('Store');
    if (!customer) throw notFound('Customer');
    await this.assertDeliveryAddress(ctx, input.customerId, input.deliveryAddressId);
    this.assertDueDate(input.dueDate);

    let pickupTask: { id: string } | null = null;
    if (input.pickupTaskId) {
      pickupTask = await db.pickupDeliveryTask
        .findFirst({
          where: { id: input.pickupTaskId, type: 'PICKUP', customerId: input.customerId },
          select: { id: true, orderId: true, status: true },
        })
        .then((t) => {
          if (!t) throw notFound('Pickup request');
          if (t.orderId) throw badRequest('PICKUP_ALREADY_CONVERTED', 'This pickup has already been converted into an order.');
          if (t.status === 'CANCELLED') throw badRequest('PICKUP_CANCELLED', 'This pickup request was cancelled.');
          return t;
        });
    }

    const priceListId = await this.pricing.resolvePriceListId(db, {
      priceListId: input.priceListId,
      customerId: input.customerId,
      storeId: input.storeId,
    });
    const resolved = await this.pricing.resolveLines(db, priceListId, input.lines);
    const totals = this.totals(resolved, input.lines, input.discount, settings);

    const paymentTotal = sumMoney(input.payments.map((p) => p.amount));
    if (toDecimal(paymentTotal).greaterThan(totals.grandTotal)) {
      throw unprocessable(
        'PAYMENT_EXCEEDS_TOTAL',
        `Payments (${this.fmt(paymentTotal, settings)}) can't be more than the order total (${this.fmt(totals.grandTotal, settings)}).`,
      );
    }

    try {
      const orderId = await db.$transaction(
        async (tx) => {
          const year = Number(dateKeyInZone(new Date(), settings.timezone).slice(0, 4));
          const seq = await reserveSequence(tx, ctx.tenantId, `order:${year}`);
          const orderId = randomUUID();
          const orderNumber = formatOrderNumber(settings.orderPrefix, year, seq);

          await tx.order.create({
            data: {
              id: orderId,
              tenantId: ctx.tenantId,
              storeId: input.storeId,
              customerId: input.customerId,
              orderNumber,
              status: OrderStatus.RECEIVED,
              priceListId,
              ...this.totalsData(totals, input.discount ?? null, settings),
              paidAmount: '0',
              balanceDue: totals.grandTotal,
              paymentStatus: 'UNPAID',
              dueDate: new Date(input.dueDate),
              deliveryMode: input.deliveryMode,
              deliveryAddressId: input.deliveryAddressId ?? null,
              notes: input.notes ?? null,
              createdById: ctx.userId,
              idempotencyKey: input.idempotencyKey ?? null,
            },
          });

          const pieces = await this.writeLines(tx, ctx.tenantId, orderId, resolved, input.lines, totals, settings);
          await tx.order.update({ where: { id: orderId }, data: { totalPieces: pieces } });

          await tx.orderStatusHistory.create({
            data: {
              tenantId: ctx.tenantId,
              orderId,
              fromStatus: null,
              toStatus: OrderStatus.RECEIVED,
              changedById: ctx.userId,
              note: pickupTask ? 'Created from pickup request' : 'Order created',
            },
          });

          if (input.payments.length) {
            await tx.payment.createMany({
              data: input.payments.map((p) => ({
                tenantId: ctx.tenantId,
                orderId,
                storeId: input.storeId,
                customerId: input.customerId,
                amount: p.amount,
                method: p.method,
                reference: p.reference ?? null,
                status: 'COMPLETED' as const,
                receivedById: ctx.userId,
              })),
            });
            await recalcOrderPayments(tx, orderId);
          } else if (toDecimal(totals.grandTotal).isZero()) {
            await recalcOrderPayments(tx, orderId);
          }

          if (pickupTask) {
            await tx.pickupDeliveryTask.update({ where: { id: pickupTask.id }, data: { orderId } });
          }

          await this.audit.log(tx, ctx, {
            action: AuditAction.ORDER_CREATED,
            entityType: 'Order',
            entityId: orderId,
            metadata: { orderNumber, grandTotal: totals.grandTotal, items: input.lines.length, pieces },
          });
          for (const p of input.payments) {
            await this.audit.log(tx, ctx, {
              action: AuditAction.PAYMENT_RECORDED,
              entityType: 'Order',
              entityId: orderId,
              metadata: { orderNumber, amount: p.amount, method: p.method },
            });
          }
          return orderId;
        },
        { timeout: 20000 },
      );
      return this.get(ctx, orderId);
    } catch (err) {
      // A concurrent double-submit with the same idempotency key: return the winner.
      if (input.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await db.order.findFirst({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
        if (existing) return this.get(ctx, existing.id);
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async get(ctx: AuthContext, id: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const order = await db.order.findFirst({ where: { id }, include: ORDER_DETAIL_INCLUDE });
    if (!order) throw notFound('Order');
    assertStoreAccess(ctx, order.storeId);

    const allowedTransitions = await this.workflow.allowedTransitions(ctx, order.status as OrderStatus);
    const options = await this.workflow.workflowOptions(ctx.tenantId);
    return {
      ...serializeOrderDetail(order),
      workflow: {
        allowedTransitions,
        nextStatus: nextOrderStage(order.status as OrderStatus, options),
        canEditItems: order.status === OrderStatus.RECEIVED && hasPermission(ctx, Permission.ORDERS_EDIT),
      },
    };
  }

  async getByNumber(ctx: AuthContext, orderNumber: string) {
    const order = await this.prisma
      .forTenant(ctx.tenantId)
      .order.findFirst({ where: { orderNumber: orderNumber.toUpperCase() }, select: { id: true } });
    if (!order) throw notFound('Order');
    return this.get(ctx, order.id);
  }

  async list(ctx: AuthContext, query: OrderListQuery) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const where = this.buildListWhere(ctx, query, settings.timezone);

    const orderBy: Prisma.OrderOrderByWithRelationInput[] = [{ [SORT_FIELDS[query.sort]]: query.dir }, { createdAt: 'desc' }];
    const [rows, total] = await Promise.all([
      db.order.findMany({
        where,
        select: ORDER_LIST_SELECT,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.order.count({ where }),
    ]);
    return { items: rows.map(serializeOrderListRow), total, page: query.page, pageSize: query.pageSize };
  }

  buildListWhere(ctx: AuthContext, query: Omit<OrderListQuery, 'page' | 'pageSize' | 'sort' | 'dir'>, timeZone: string) {
    const and: Prisma.OrderWhereInput[] = [storeScope(ctx, query.storeId)];
    const now = new Date();
    const today = zonedDayRange(dateKeyInZone(now, timeZone), timeZone);

    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.paymentStatus) and.push({ paymentStatus: query.paymentStatus, status: { not: 'CANCELLED' } });
    if (query.customerId) and.push({ customerId: query.customerId });
    if (query.hasBalance) and.push({ balanceDue: { gt: 0 }, status: { not: 'CANCELLED' } });
    if (query.from || query.to) {
      const range = zonedRange(query.from ?? query.to!, query.to ?? query.from!, timeZone);
      and.push({ createdAt: { gte: range.start, lt: range.end } });
    }
    switch (query.quick) {
      case 'today':
        and.push({ createdAt: { gte: today.start, lt: today.end } });
        break;
      case 'due_today':
        and.push({ dueDate: { gte: today.start, lt: today.end }, status: { in: [...OPEN_ORDER_STATUSES] } });
        break;
      case 'overdue':
        and.push({ dueDate: { lt: now }, status: { in: [...PENDING_ORDER_STATUSES] } });
        break;
      case 'ready':
        and.push({ status: OrderStatus.READY });
        break;
      case 'unpaid':
        and.push({ paymentStatus: { in: ['UNPAID', 'PARTIAL'] }, status: { not: 'CANCELLED' } });
        break;
      case 'open':
        and.push({ status: { in: [...OPEN_ORDER_STATUSES] } });
        break;
    }
    if (query.q) and.push(orderSearchWhere(query.q));
    return { AND: and } satisfies Prisma.OrderWhereInput;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  async update(ctx: AuthContext, id: string, input: UpdateOrderInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);

    await db.$transaction(
      async (tx) => {
        if (!(await lockOrder(tx, ctx.tenantId, id))) throw notFound('Order');
        const order = await tx.order.findFirstOrThrow({
          where: { id },
          include: { lines: { orderBy: { position: 'asc' }, include: { modifiers: true } } },
        });
        assertStoreAccess(ctx, order.storeId);

        if (order.status === OrderStatus.CANCELLED) {
          throw new AppError(
            'ORDER_ALREADY_CANCELLED',
            'This order has been cancelled and can no longer be edited.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (order.status === OrderStatus.DELIVERED) {
          throw new AppError('ORDER_ALREADY_DELIVERED', 'Delivered orders can no longer be edited.', HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (input.lines && order.status !== OrderStatus.RECEIVED) {
          throw unprocessable('ITEMS_LOCKED', 'Items can only be changed while the order is still Received.');
        }
        const discountChanged = input.discount !== undefined;
        if (discountChanged && input.discount && toDecimal(input.discount.value).greaterThan(0)) {
          assertPermission(ctx, Permission.ORDERS_DISCOUNT, "You don't have permission to give discounts.");
        }
        if (input.dueDate) this.assertDueDate(input.dueDate);
        if (input.deliveryAddressId) await this.assertDeliveryAddress(ctx, order.customerId, input.deliveryAddressId);

        const changes: string[] = [];
        const data: Prisma.OrderUncheckedUpdateInput = {};
        if (input.dueDate && new Date(input.dueDate).getTime() !== order.dueDate.getTime()) {
          data.dueDate = new Date(input.dueDate);
          changes.push('dueDate');
        }
        if (input.deliveryMode && input.deliveryMode !== order.deliveryMode) {
          data.deliveryMode = input.deliveryMode;
          changes.push('deliveryMode');
        }
        if (input.deliveryAddressId !== undefined && input.deliveryAddressId !== order.deliveryAddressId) {
          data.deliveryAddressId = input.deliveryAddressId;
          changes.push('deliveryAddress');
        }
        if (input.notes !== undefined && input.notes !== order.notes) {
          data.notes = input.notes;
          changes.push('notes');
        }

        const before = { grandTotal: money(order.grandTotal), lines: order.lines.map((l) => `${l.quantity} × ${l.description}`) };
        let after: { grandTotal: string; lines?: string[] } | undefined;

        if (input.lines || discountChanged) {
          const discount: DiscountInput | null = discountChanged
            ? (input.discount ?? null)
            : order.discountType && order.discountValue
              ? { type: order.discountType, value: order.discountValue.toString() }
              : null;
          const lineInputs: OrderLineInput[] =
            input.lines ??
            order.lines.map((l) => ({
              serviceCategoryId: l.serviceCategoryId,
              serviceItemId: l.serviceItemId,
              quantity: l.quantity.toString(),
              modifierIds: l.modifiers.map((m) => m.modifierId).filter((m): m is string => Boolean(m)),
              notes: l.notes,
            }));

          let resolved: ResolvedLine[];
          if (input.lines) {
            const priceListId =
              order.priceListId ?? (await this.pricing.resolvePriceListId(tx, { customerId: order.customerId, storeId: order.storeId }));
            resolved = await this.pricing.resolveLines(tx, priceListId, input.lines);
          } else {
            // Keep the prices the order was created with; only the discount changes.
            resolved = order.lines.map((l) => ({
              serviceCategoryId: l.serviceCategoryId,
              serviceItemId: l.serviceItemId,
              categoryName: l.categoryName,
              itemName: l.itemName,
              description: l.description,
              unitType: l.unitType,
              piecesPerUnit: 1,
              unitPrice: l.unitPrice.toString(),
              modifiers: l.modifiers.map((m) => ({
                modifierId: m.modifierId ?? '',
                name: m.name,
                type: m.type,
                value: m.value.toString(),
              })),
            }));
          }
          const totals = this.totals(resolved, lineInputs, discount, settings);
          if (toDecimal(totals.grandTotal).lessThan(order.paidAmount.toString())) {
            throw unprocessable(
              'TOTAL_BELOW_PAID',
              `The new total (${this.fmt(totals.grandTotal, settings)}) is less than what has been paid (${this.fmt(order.paidAmount, settings)}). Refund a payment first.`,
            );
          }
          Object.assign(data, this.totalsData(totals, discount, settings));
          if (discountChanged) changes.push('discount');

          if (input.lines) {
            // Items are only editable before processing starts, so regenerating
            // lines and garment tags is safe; the previous lines are kept in the audit log.
            await tx.garmentUnit.deleteMany({ where: { orderId: id } });
            await tx.orderLine.deleteMany({ where: { orderId: id } });
            const pieces = await this.writeLines(tx, ctx.tenantId, id, resolved, input.lines, totals, settings);
            data.totalPieces = pieces;
            changes.push('items');
            after = { grandTotal: totals.grandTotal, lines: input.lines.map((l, i) => `${l.quantity} × ${resolved[i]!.description}`) };
          } else {
            const pricedLines = totals.lines;
            for (const [i, line] of order.lines.entries()) {
              const priced = pricedLines[i];
              if (priced) {
                await tx.orderLine.update({
                  where: { id: line.id },
                  data: { modifiersAmount: priced.modifiersAmount, lineTotal: priced.lineTotal },
                });
              }
            }
            after = { grandTotal: totals.grandTotal };
          }
        }

        if (!changes.length) return { changed: false };
        await tx.order.update({ where: { id }, data });
        if (data.subtotal !== undefined) await recalcOrderPayments(tx, id);

        await this.audit.log(tx, ctx, {
          action: AuditAction.ORDER_UPDATED,
          entityType: 'Order',
          entityId: id,
          metadata: { orderNumber: order.orderNumber, changes, before, ...(after ? { after } : {}) },
        });
        return { changed: true };
      },
      { timeout: 20000 },
    );
    return this.get(ctx, id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private totals(
    resolved: ResolvedLine[],
    lines: Array<Pick<OrderLineInput, 'quantity'>>,
    discount: DiscountInput | null | undefined,
    settings: Settings,
  ): PricingResult {
    return calculateOrderTotals({
      lines: resolved.map((r, i) => ({ unitPrice: r.unitPrice, quantity: lines[i]!.quantity, modifiers: r.modifiers })),
      discount: discount ?? null,
      taxRate: settings.taxRate.toString(),
      taxInclusive: settings.taxInclusive,
    });
  }

  private totalsData(totals: PricingResult, discount: DiscountInput | null, settings: Settings) {
    const hasDiscount = discount && toDecimal(discount.value).greaterThan(0);
    return {
      subtotal: totals.subtotal,
      discountType: hasDiscount ? discount.type : null,
      discountValue: hasDiscount ? discount.value : null,
      discountAmount: totals.discountAmount,
      taxName: settings.taxName,
      taxRate: settings.taxRate,
      taxInclusive: settings.taxInclusive,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
    };
  }

  /** Writes order lines, line modifiers and generated garment units. Returns garment count. */
  private async writeLines(
    tx: TenantTx,
    tenantId: string,
    orderId: string,
    resolved: ResolvedLine[],
    inputs: OrderLineInput[],
    totals: PricingResult,
    settings: Settings,
  ): Promise<number> {
    const lineIds = resolved.map(() => randomUUID());
    const garmentCounts = resolved.map((r, i) => garmentUnitsForLine(r.unitType, inputs[i]!.quantity, r.piecesPerUnit));
    const totalGarments = garmentCounts.reduce((a, b) => a + b, 0);
    const firstTag = totalGarments ? await reserveSequence(tx, tenantId, 'garment', totalGarments) : 0;

    await tx.orderLine.createMany({
      data: resolved.map((r, i) => ({
        id: lineIds[i]!,
        tenantId,
        orderId,
        serviceCategoryId: r.serviceCategoryId,
        serviceItemId: r.serviceItemId,
        description: r.description,
        categoryName: r.categoryName,
        itemName: r.itemName,
        unitType: r.unitType,
        quantity: inputs[i]!.quantity,
        unitPrice: r.unitPrice,
        modifiersAmount: totals.lines[i]!.modifiersAmount,
        lineTotal: totals.lines[i]!.lineTotal,
        notes: inputs[i]!.notes ?? null,
        position: i,
      })),
    });

    const lineModifiers = resolved.flatMap((r, i) =>
      r.modifiers.map((m) => {
        const quantity = toDecimal(inputs[i]!.quantity);
        const amount = priceModifier(m, roundMoney(toDecimal(r.unitPrice).times(quantity)), quantity);
        return {
          tenantId,
          orderLineId: lineIds[i]!,
          modifierId: m.modifierId || null,
          name: m.name,
          type: m.type,
          value: m.value,
          amount: amount.toFixed(2),
        };
      }),
    );
    if (lineModifiers.length) await tx.orderLineModifier.createMany({ data: lineModifiers });

    if (totalGarments) {
      let seq = firstTag;
      const garments: Prisma.GarmentUnitCreateManyInput[] = [];
      resolved.forEach((_, i) => {
        const details = inputs[i]!.garments ?? [];
        for (let g = 0; g < garmentCounts[i]!; g++) {
          const d = details[g];
          garments.push({
            tenantId,
            orderId,
            orderLineId: lineIds[i]!,
            tagCode: formatTagCode(settings.garmentPrefix, seq++),
            status: OrderStatus.RECEIVED,
            color: d?.color ?? null,
            brand: d?.brand ?? null,
            fabric: d?.fabric ?? null,
            issues: d?.issues ?? [],
            damageNotes: d?.damageNotes ?? null,
            specialInstructions: d?.specialInstructions ?? inputs[i]!.notes ?? null,
          });
        }
      });
      await tx.garmentUnit.createMany({ data: garments });
    }
    return totalGarments;
  }

  private async assertDeliveryAddress(ctx: AuthContext, customerId: string, addressId?: string | null) {
    if (!addressId) return;
    const address = await this.prisma.forTenant(ctx.tenantId).customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!address) throw notFound('Delivery address');
  }

  private assertDueDate(iso: string) {
    const due = new Date(iso);
    if (Number.isNaN(due.getTime())) throw badRequest('INVALID_DUE_DATE', 'Choose a valid due date.');
    if (due.getTime() < Date.now() - 60 * 60 * 1000) {
      throw badRequest('DUE_DATE_IN_PAST', "The due date can't be in the past.");
    }
  }

  private fmt(value: { toString(): string } | string, settings: Settings) {
    return formatMoney(value.toString(), settings.currency, settings.locale);
  }
}

/** Matches order number, customer phone/name or a garment tag. */
export function orderSearchWhere(raw: string): Prisma.OrderWhereInput {
  const q = raw.trim();
  const kind = classifySearch(q);
  if (kind === 'order') return { orderNumber: { equals: q.toUpperCase() } };
  if (kind === 'tag') {
    return {
      OR: [{ garments: { some: { tagCode: q.toUpperCase() } } }, { orderNumber: { contains: q, mode: 'insensitive' } }],
    };
  }
  if (kind === 'phone') {
    const digits = phoneDigits(q);
    return {
      OR: [{ customer: { phone: { contains: digits } } }, { orderNumber: { contains: digits } }],
    };
  }
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    OR: [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      {
        AND: words.map((w) => ({
          OR: [
            { customer: { firstName: { contains: w, mode: 'insensitive' as const } } },
            { customer: { lastName: { contains: w, mode: 'insensitive' as const } } },
          ],
        })),
      },
    ],
  };
}
