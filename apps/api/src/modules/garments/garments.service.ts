import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  BulkGarmentStatusInput,
  canTransitionGarment,
  ChangeGarmentStatusInput,
  GarmentListQuery,
  ORDER_STATUS_LABEL,
  OrderStatus,
  stageIndex,
  UpdateGarmentInput,
} from '@rinseops/shared';
import { AuthContext, assertStoreAccess, storeScope } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { money } from '../../common/util/serialize';
import { lockOrder } from '../payments/ledger';
import { rackLocation } from '../orders/order-serializer';
import { WorkflowService } from '../workflow/workflow.service';

const GARMENT_INCLUDE = {
  orderLine: { select: { description: true, itemName: true, categoryName: true } },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      dueDate: true,
      balanceDue: true,
      paymentStatus: true,
      storeId: true,
      store: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      rackAssignments: {
        where: { removedAt: null },
        select: { rackSlot: { select: { id: true, code: true, rack: { select: { id: true, name: true, code: true } } } } },
      },
    },
  },
} satisfies Prisma.GarmentUnitInclude;

type GarmentRow = Prisma.GarmentUnitGetPayload<{ include: typeof GARMENT_INCLUDE }>;

const EDITABLE_ORDER_STATUSES: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.QUALITY_CHECK];

@Injectable()
export class GarmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
  ) {}

  async list(ctx: AuthContext, query: GarmentListQuery) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const and: Prisma.GarmentUnitWhereInput[] = [{ order: storeScope(ctx, query.storeId) }];
    if (query.status) and.push({ status: query.status });
    if (query.orderId) and.push({ orderId: query.orderId });
    if (query.hasIssues === 'true') {
      and.push({ OR: [{ issues: { isEmpty: false } }, { damageNotes: { not: null } }] });
    }
    if (query.q) {
      const q = query.q.trim();
      and.push({
        OR: [
          { tagCode: { contains: q, mode: 'insensitive' } },
          { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
          { orderLine: { itemName: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }
    const where = { AND: and };
    const [rows, total, counts] = await Promise.all([
      db.garmentUnit.findMany({
        where,
        include: GARMENT_INCLUDE,
        orderBy: [{ order: { dueDate: 'asc' } }, { tagCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.garmentUnit.count({ where }),
      db.garmentUnit.groupBy({
        by: ['status'],
        where: { order: storeScope(ctx, query.storeId), status: { in: EDITABLE_ORDER_STATUSES.concat(OrderStatus.READY) } },
        _count: { _all: true },
      }),
    ]);
    return {
      items: rows.map(serializeGarment),
      total,
      page: query.page,
      pageSize: query.pageSize,
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    };
  }

  async getByTag(ctx: AuthContext, tagCode: string) {
    const garment = await this.prisma
      .forTenant(ctx.tenantId)
      .garmentUnit.findFirst({ where: { tagCode: tagCode.trim().toUpperCase() }, include: GARMENT_INCLUDE });
    if (!garment)
      throw new AppError('GARMENT_NOT_FOUND', `No garment found with tag ${tagCode.trim().toUpperCase()}.`, HttpStatus.NOT_FOUND);
    assertStoreAccess(ctx, garment.order.storeId);
    return this.withHistory(ctx, garment);
  }

  async get(ctx: AuthContext, id: string) {
    const garment = await this.prisma.forTenant(ctx.tenantId).garmentUnit.findFirst({ where: { id }, include: GARMENT_INCLUDE });
    if (!garment) throw notFound('Garment');
    assertStoreAccess(ctx, garment.order.storeId);
    return this.withHistory(ctx, garment);
  }

  async update(ctx: AuthContext, id: string, input: UpdateGarmentInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const garment = await db.garmentUnit.findFirst({ where: { id }, include: { order: { select: { storeId: true, orderNumber: true } } } });
    if (!garment) throw notFound('Garment');
    assertStoreAccess(ctx, garment.order.storeId);
    await db.$transaction(async (tx) => {
      await tx.garmentUnit.update({ where: { id }, data: input });
      await this.audit.log(tx, ctx, {
        action: AuditAction.GARMENT_UPDATED,
        entityType: 'GarmentUnit',
        entityId: id,
        metadata: { tagCode: garment.tagCode, orderNumber: garment.order.orderNumber, fields: Object.keys(input) },
      });
    });
    return this.get(ctx, id);
  }

  async changeStatus(ctx: AuthContext, id: string, input: ChangeGarmentStatusInput) {
    const garment = await this.prisma.forTenant(ctx.tenantId).garmentUnit.findFirst({ where: { id }, select: { tagCode: true } });
    if (!garment) throw notFound('Garment');
    await this.applyStatus(ctx, garment.tagCode, input.status, input.note ?? null);
    return this.get(ctx, id);
  }

  /** Scan-friendly bulk update. Each tag is processed independently. */
  async bulkStatus(ctx: AuthContext, input: BulkGarmentStatusInput) {
    const results: Array<{ tagCode: string; ok: boolean; message?: string; orderNumber?: string }> = [];
    for (const raw of [...new Set(input.tagCodes.map((t) => t.trim().toUpperCase()))]) {
      try {
        const orderNumber = await this.applyStatus(ctx, raw, input.status, input.note ?? null);
        results.push({ tagCode: raw, ok: true, orderNumber });
      } catch (err) {
        results.push({ tagCode: raw, ok: false, message: err instanceof AppError ? err.message : 'Could not update this garment.' });
      }
    }
    return { results, updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  }

  private async applyStatus(ctx: AuthContext, tagCode: string, to: OrderStatus, note: string | null): Promise<string> {
    const db = this.prisma.forTenant(ctx.tenantId);
    const garment = await db.garmentUnit.findFirst({
      where: { tagCode },
      include: { order: { select: { id: true, storeId: true, status: true, orderNumber: true } } },
    });
    if (!garment) throw new AppError('GARMENT_NOT_FOUND', `No garment found with tag ${tagCode}.`, HttpStatus.NOT_FOUND);
    assertStoreAccess(ctx, garment.order.storeId);

    await db.$transaction(async (tx) => {
      await lockOrder(tx, ctx.tenantId, garment.orderId);
      const order = await tx.order.findFirstOrThrow({ where: { id: garment.orderId }, select: { status: true } });
      const current = await tx.garmentUnit.findFirstOrThrow({ where: { id: garment.id }, select: { status: true } });
      const orderStatus = order.status as OrderStatus;
      const from = current.status as OrderStatus;

      if (!EDITABLE_ORDER_STATUSES.includes(orderStatus)) {
        throw new AppError(
          'ORDER_NOT_IN_PROCESSING',
          `Order ${garment.order.orderNumber} is ${ORDER_STATUS_LABEL[orderStatus]} — garment status can't be changed.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (from === to) {
        throw new AppError('STATUS_UNCHANGED', `${tagCode} is already ${ORDER_STATUS_LABEL[to]}.`, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (!canTransitionGarment(from, to) || stageIndex(to) < stageIndex(orderStatus)) {
        throw new AppError(
          'INVALID_STATUS_TRANSITION',
          `${tagCode} can't move from ${ORDER_STATUS_LABEL[from]} to ${ORDER_STATUS_LABEL[to]}.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      await tx.garmentUnit.update({ where: { id: garment.id }, data: { status: to } });
      await tx.garmentStatusHistory.create({
        data: { tenantId: ctx.tenantId, garmentId: garment.id, fromStatus: from, toStatus: to, changedById: ctx.userId, note },
      });
      await this.audit.log(tx, ctx, {
        action: AuditAction.GARMENT_STATUS_CHANGED,
        entityType: 'GarmentUnit',
        entityId: garment.id,
        metadata: { tagCode, orderNumber: garment.order.orderNumber, from, to },
      });
      await this.workflow.autoAdvanceFromGarments(tx, ctx, garment.orderId);
    });
    return garment.order.orderNumber;
  }

  private async withHistory(ctx: AuthContext, garment: GarmentRow) {
    const history = await this.prisma.forTenant(ctx.tenantId).garmentStatusHistory.findMany({
      where: { garmentId: garment.id },
      orderBy: { changedAt: 'asc' },
      include: { changedBy: { select: { id: true, name: true } } },
    });
    return { ...serializeGarment(garment), history };
  }
}

function serializeGarment(g: GarmentRow) {
  const { rackAssignments, balanceDue, ...order } = g.order;
  return {
    ...g,
    order: { ...order, balanceDue: money(balanceDue), rack: rackLocation(rackAssignments[0]?.rackSlot) },
  };
}
