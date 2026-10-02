import { HttpStatus, Injectable } from '@nestjs/common';
import {
  allowedOrderTransitions,
  AuditAction,
  canTransitionOrder,
  formatMoney,
  nextOrderStage,
  ORDER_STATUS_LABEL,
  OrderStatus,
  Permission,
  permissionForOrderTransition,
  stageIndex,
  toDecimal,
  WorkflowOptions,
} from '@rinseops/shared';
import { AuthContext, assertPermission, assertStoreAccess, hasPermission } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, badRequest, conflict, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantTx } from '../../common/prisma/tenant-extension';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { lockOrder } from '../payments/ledger';
import { releaseRack } from '../racks/rack-ops';

export interface TransitionActor {
  tenantId: string;
  userId: string | null;
  ipAddress?: string;
}

export interface TransitionOptions {
  note?: string | null;
  allowOutstanding?: boolean;
}

const PROCESSING_STAGES: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.QUALITY_CHECK, OrderStatus.READY];

/**
 * Owns order status changes. Every change is validated against the workflow,
 * appended to OrderStatusHistory (never overwritten), cascaded to garments and
 * audited — all in one transaction.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async workflowOptions(tenantId: string): Promise<WorkflowOptions> {
    const settings = await loadTenantSettings(this.prisma, tenantId);
    return { skipQualityCheck: settings.skipQualityCheck };
  }

  async allowedTransitions(ctx: AuthContext, status: OrderStatus): Promise<OrderStatus[]> {
    const options = await this.workflowOptions(ctx.tenantId);
    return allowedOrderTransitions(status, options).filter((s) => hasPermission(ctx, permissionForOrderTransition(s)));
  }

  /** User-initiated status change (API). */
  async changeStatus(ctx: AuthContext, orderId: string, to: OrderStatus, opts: TransitionOptions = {}) {
    assertPermission(ctx, permissionForOrderTransition(to));
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const options: WorkflowOptions = { skipQualityCheck: settings.skipQualityCheck };
    const fmt = (v: { toString(): string }) => formatMoney(v.toString(), settings.currency, settings.locale);

    return db.$transaction(async (tx) => {
      if (!(await lockOrder(tx, ctx.tenantId, orderId))) throw notFound('Order');
      const order = await tx.order.findFirstOrThrow({ where: { id: orderId } });
      assertStoreAccess(ctx, order.storeId);

      this.assertTransition(order.status as OrderStatus, to, options);

      if (to === OrderStatus.DELIVERED && toDecimal(order.balanceDue.toString()).greaterThan(0)) {
        if (!opts.allowOutstanding) {
          throw new AppError(
            'OUTSTANDING_BALANCE',
            `This order still has ${fmt(order.balanceDue)} outstanding. Collect payment before delivering.`,
            HttpStatus.UNPROCESSABLE_ENTITY,
            { balanceDue: order.balanceDue.toString() },
          );
        }
        assertPermission(ctx, Permission.ORDERS_DELIVER_WITH_BALANCE, 'Only a manager can deliver an order with an outstanding balance.');
      }
      if (to === OrderStatus.CANCELLED) {
        if (!opts.note) throw badRequest('CANCEL_REASON_REQUIRED', 'Please give a reason for cancelling.');
        if (toDecimal(order.paidAmount.toString()).greaterThan(0)) {
          throw new AppError(
            'ORDER_HAS_PAYMENTS',
            `This order has ${fmt(order.paidAmount)} in payments. Refund them before cancelling.`,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      await this.applyTransition(tx, ctx, order, to, opts.note ?? null);
      return { id: orderId, status: to };
    });
  }

  /**
   * Applies a validated transition inside an existing transaction.
   * Callers are responsible for locking and validation.
   */
  async applyTransition(
    tx: TenantTx,
    actor: TransitionActor,
    order: { id: string; status: string; orderNumber: string },
    to: OrderStatus,
    note: string | null,
  ) {
    const from = order.status as OrderStatus;
    const now = new Date();
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: from },
      data: {
        status: to,
        ...(to === OrderStatus.READY ? { readyAt: now } : {}),
        ...(to === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
        ...(to === OrderStatus.CANCELLED ? { cancelledAt: now, cancelReason: note } : {}),
      },
    });
    if (updated.count !== 1) {
      throw conflict('ORDER_CHANGED', 'This order was just updated by someone else. Refresh and try again.');
    }

    await tx.orderStatusHistory.create({
      data: { tenantId: actor.tenantId, orderId: order.id, fromStatus: from, toStatus: to, changedById: actor.userId, note },
    });

    await this.cascadeToGarments(tx, actor, order.id, from, to);

    let rackReleased: { slotCode: string; rackName: string } | null = null;
    if (to === OrderStatus.DELIVERED || to === OrderStatus.CANCELLED) {
      rackReleased = await releaseRack(tx, order.id, to === OrderStatus.DELIVERED ? 'DELIVERED' : 'CANCELLED', actor.userId);
    } else if (from === OrderStatus.READY && stageIndex(to) < stageIndex(from)) {
      // Sent back for rework — it no longer sits on the rack.
      rackReleased = await releaseRack(tx, order.id, 'REMOVED', actor.userId);
    }

    await this.audit.log(tx, actor, {
      action: to === OrderStatus.CANCELLED ? AuditAction.ORDER_CANCELLED : AuditAction.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        from,
        to,
        note,
        ...(rackReleased ? { rackReleased: rackReleased.slotCode } : {}),
      },
    });
  }

  /**
   * After garment-level updates, moves the order forward when every garment
   * has reached a later stage. Steps through each stage so history stays valid.
   */
  async autoAdvanceFromGarments(tx: TenantTx, actor: TransitionActor, orderId: string) {
    const options = await this.workflowOptions(actor.tenantId);
    const order = await tx.order.findFirstOrThrow({
      where: { id: orderId },
      select: { id: true, status: true, orderNumber: true },
    });
    const garments = await tx.garmentUnit.findMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      select: { status: true },
    });
    if (!garments.length) return;
    const minStage = Math.min(...garments.map((g) => stageIndex(g.status as OrderStatus)));

    let current = order.status as OrderStatus;
    while (PROCESSING_STAGES.includes(current) && stageIndex(current) < minStage) {
      const next = nextOrderStage(current, options);
      if (!next || stageIndex(next) > minStage || next === OrderStatus.DELIVERED) break;
      await this.applyTransitionOrderOnly(
        tx,
        actor,
        { ...order, status: current },
        next,
        `All garments reached ${ORDER_STATUS_LABEL[next]}`,
      );
      current = next;
    }
  }

  /** Like applyTransition but without cascading back to garments (they drove the change). */
  private async applyTransitionOrderOnly(
    tx: TenantTx,
    actor: TransitionActor,
    order: { id: string; status: string; orderNumber: string },
    to: OrderStatus,
    note: string,
  ) {
    const from = order.status as OrderStatus;
    await tx.order.update({
      where: { id: order.id },
      data: { status: to, ...(to === OrderStatus.READY ? { readyAt: new Date() } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: { tenantId: actor.tenantId, orderId: order.id, fromStatus: from, toStatus: to, changedById: actor.userId, note },
    });
    await this.audit.log(tx, actor, {
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber, from, to, note, automatic: true },
    });
  }

  assertTransition(from: OrderStatus, to: OrderStatus, options: WorkflowOptions) {
    if (from === OrderStatus.CANCELLED) {
      throw new AppError('ORDER_ALREADY_CANCELLED', 'This order has already been cancelled.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (from === OrderStatus.DELIVERED) {
      throw new AppError('ORDER_ALREADY_DELIVERED', 'This order has already been delivered.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (from === to) {
      throw new AppError('STATUS_UNCHANGED', `The order is already ${ORDER_STATUS_LABEL[to]}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!canTransitionOrder(from, to, options)) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `An order can't move from ${ORDER_STATUS_LABEL[from]} to ${ORDER_STATUS_LABEL[to]}.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        { from, to, allowed: allowedOrderTransitions(from, options) },
      );
    }
  }

  private async cascadeToGarments(tx: TenantTx, actor: TransitionActor, orderId: string, from: OrderStatus, to: OrderStatus) {
    const garments = await tx.garmentUnit.findMany({
      where: { orderId, status: { notIn: ['CANCELLED', 'DELIVERED'] } },
      select: { id: true, status: true },
    });
    let affected: typeof garments;
    if (to === OrderStatus.DELIVERED || to === OrderStatus.CANCELLED) {
      affected = garments;
    } else if (stageIndex(to) > stageIndex(from)) {
      // Forward: bring lagging garments up to the order's stage.
      affected = garments.filter((g) => stageIndex(g.status as OrderStatus) < stageIndex(to));
    } else {
      // Rework: garments ahead of the new stage move back with the order.
      affected = garments.filter((g) => stageIndex(g.status as OrderStatus) > stageIndex(to));
    }
    if (!affected.length) return;

    await tx.garmentUnit.updateMany({ where: { id: { in: affected.map((g) => g.id) } }, data: { status: to } });
    await tx.garmentStatusHistory.createMany({
      data: affected.map((g) => ({
        tenantId: actor.tenantId,
        garmentId: g.id,
        fromStatus: g.status,
        toStatus: to,
        changedById: actor.userId,
        note: 'Updated with order',
      })),
    });
  }
}
