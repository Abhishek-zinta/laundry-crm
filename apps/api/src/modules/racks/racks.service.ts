import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AssignRackInput,
  AuditAction,
  CreateRackInput,
  CreateRackSlotInput,
  customerDisplayName,
  ORDER_STATUS_LABEL,
  OrderStatus,
  UpdateRackInput,
  UpdateRackSlotInput,
} from '@rinseops/shared';
import { AuthContext, assertStoreAccess } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, badRequest, conflict, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { TenantTx } from '../../common/prisma/tenant-extension';
import { money } from '../../common/util/serialize';
import { lockOrder } from '../payments/ledger';
import { slotCode } from '../tenants/tenant-provisioning';
import { releaseRack } from './rack-ops';

@Injectable()
export class RacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Rack board for a store: every slot with what is currently on it. */
  async board(ctx: AuthContext, requestedStoreId?: string) {
    const storeId = requestedStoreId ?? ctx.storeIds[0];
    if (!storeId) return { storeId: null, racks: [], stats: { slots: 0, occupied: 0, capacity: 0, used: 0 } };
    assertStoreAccess(ctx, storeId);

    const racks = await this.prisma.forTenant(ctx.tenantId).rack.findMany({
      where: { storeId },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      include: {
        slots: {
          orderBy: [{ position: 'asc' }, { code: 'asc' }],
          include: {
            assignments: {
              where: { removedAt: null },
              orderBy: { assignedAt: 'asc' },
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    balanceDue: true,
                    totalPieces: true,
                    dueDate: true,
                    customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let slots = 0;
    let occupied = 0;
    let capacity = 0;
    let used = 0;
    const result = racks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      code: rack.code,
      description: rack.description,
      isActive: rack.isActive,
      displayOrder: rack.displayOrder,
      slots: rack.slots.map((slot) => {
        if (rack.isActive && slot.isActive) {
          slots += 1;
          capacity += slot.capacity;
          used += slot.assignments.length;
          if (slot.assignments.length) occupied += 1;
        }
        return {
          id: slot.id,
          code: slot.code,
          capacity: slot.capacity,
          isActive: slot.isActive,
          available: rack.isActive && slot.isActive && slot.assignments.length < slot.capacity,
          orders: slot.assignments.map((a) => ({
            assignmentId: a.id,
            assignedAt: a.assignedAt,
            ...a.order,
            balanceDue: money(a.order.balanceDue),
            customerName: customerDisplayName(a.order.customer),
          })),
        };
      }),
    }));
    return { storeId, racks: result, stats: { slots, occupied, capacity, used } };
  }

  async createRack(ctx: AuthContext, input: CreateRackInput) {
    assertStoreAccess(ctx, input.storeId);
    const db = this.prisma.forTenant(ctx.tenantId);
    if (!(await db.store.findFirst({ where: { id: input.storeId } }))) throw notFound('Store');
    if (await db.rack.findFirst({ where: { storeId: input.storeId, code: input.code } })) {
      throw conflict('RACK_CODE_TAKEN', `Rack ${input.code} already exists in this store.`);
    }
    return db.$transaction(async (tx) => {
      const rack = await tx.rack.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          name: input.name,
          code: input.code,
          description: input.description ?? null,
          displayOrder: input.displayOrder,
        },
      });
      if (input.slotCount > 0) {
        await tx.rackSlot.createMany({
          data: Array.from({ length: input.slotCount }, (_, i) => ({
            tenantId: ctx.tenantId,
            rackId: rack.id,
            code: slotCode(input.code, i + 1),
            capacity: input.slotCapacity,
            position: i,
          })),
        });
      }
      return rack;
    });
  }

  async updateRack(ctx: AuthContext, id: string, input: UpdateRackInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const rack = await db.rack.findFirst({ where: { id } });
    if (!rack) throw notFound('Rack');
    assertStoreAccess(ctx, rack.storeId);
    if (input.isActive === false) {
      const occupied = await db.rackAssignment.count({ where: { removedAt: null, rackSlot: { rackId: id } } });
      if (occupied) throw badRequest('RACK_OCCUPIED', `${rack.name} still holds ${occupied} order(s). Move them first.`);
    }
    return db.rack.update({ where: { id }, data: input });
  }

  async addSlot(ctx: AuthContext, rackId: string, input: CreateRackSlotInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const rack = await db.rack.findFirst({ where: { id: rackId }, include: { _count: { select: { slots: true } } } });
    if (!rack) throw notFound('Rack');
    assertStoreAccess(ctx, rack.storeId);
    if (await db.rackSlot.findFirst({ where: { rackId, code: input.code } })) {
      throw conflict('SLOT_CODE_TAKEN', `Slot ${input.code} already exists on ${rack.name}.`);
    }
    return db.rackSlot.create({
      data: { tenantId: ctx.tenantId, rackId, code: input.code, capacity: input.capacity, position: rack._count.slots },
    });
  }

  async updateSlot(ctx: AuthContext, slotId: string, input: UpdateRackSlotInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const slot = await db.rackSlot.findFirst({
      where: { id: slotId },
      include: { rack: { select: { storeId: true } }, _count: { select: { assignments: { where: { removedAt: null } } } } },
    });
    if (!slot) throw notFound('Rack slot');
    assertStoreAccess(ctx, slot.rack.storeId);
    const inUse = slot._count.assignments;
    if (input.capacity !== undefined && input.capacity < inUse) {
      throw badRequest('SLOT_CAPACITY_TOO_LOW', `${slot.code} currently holds ${inUse} order(s); capacity can't be lower.`);
    }
    if (input.isActive === false && inUse) {
      throw badRequest('SLOT_OCCUPIED', `${slot.code} is occupied. Move the order(s) first.`);
    }
    return db.rackSlot.update({ where: { id: slotId }, data: input });
  }

  /** Assigns a READY order to a slot, or moves it if it is already racked. */
  async assign(ctx: AuthContext, orderId: string, input: AssignRackInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    return db.$transaction(async (tx) => {
      if (!(await lockOrder(tx, ctx.tenantId, orderId))) throw notFound('Order');
      const order = await tx.order.findFirstOrThrow({
        where: { id: orderId },
        select: { id: true, orderNumber: true, status: true, storeId: true },
      });
      assertStoreAccess(ctx, order.storeId);
      if (order.status !== OrderStatus.READY) {
        throw new AppError(
          'RACK_ORDER_NOT_READY',
          `Only ready orders can be racked. This order is ${ORDER_STATUS_LABEL[order.status as OrderStatus]}.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const slot = await this.lockSlot(tx, ctx.tenantId, input.rackSlotId);
      if (slot.rack.storeId !== order.storeId) {
        throw badRequest('RACK_WRONG_STORE', 'That rack belongs to a different store.');
      }
      if (!slot.isActive || !slot.rack.isActive) {
        throw new AppError('RACK_SLOT_UNAVAILABLE', `${slot.code} is not in use.`, HttpStatus.UNPROCESSABLE_ENTITY);
      }

      const current = await tx.rackAssignment.findFirst({
        where: { orderId, removedAt: null },
        include: { rackSlot: { select: { code: true } } },
      });
      if (current?.rackSlotId === slot.id) return { slotCode: slot.code, rackName: slot.rack.name, unchanged: true };

      const occupants = await tx.rackAssignment.count({ where: { rackSlotId: slot.id, removedAt: null } });
      if (occupants >= slot.capacity) {
        throw new AppError('RACK_SLOT_FULL', `${slot.code} is full. Choose another slot.`, HttpStatus.CONFLICT, {
          capacity: slot.capacity,
        });
      }

      if (current) await releaseRack(tx, orderId, 'MOVED', ctx.userId);
      await tx.rackAssignment.create({
        data: { tenantId: ctx.tenantId, orderId, rackSlotId: slot.id, assignedById: ctx.userId, note: input.note ?? null },
      });
      await this.audit.log(tx, ctx, {
        action: current ? AuditAction.RACK_MOVED : AuditAction.RACK_ASSIGNED,
        entityType: 'Order',
        entityId: orderId,
        metadata: {
          orderNumber: order.orderNumber,
          rack: slot.rack.name,
          slot: slot.code,
          ...(current ? { from: current.rackSlot.code } : {}),
        },
      });
      return { slotCode: slot.code, rackName: slot.rack.name, unchanged: false };
    });
  }

  async remove(ctx: AuthContext, orderId: string) {
    const db = this.prisma.forTenant(ctx.tenantId);
    return db.$transaction(async (tx) => {
      if (!(await lockOrder(tx, ctx.tenantId, orderId))) throw notFound('Order');
      const order = await tx.order.findFirstOrThrow({ where: { id: orderId }, select: { orderNumber: true, storeId: true } });
      assertStoreAccess(ctx, order.storeId);
      const released = await releaseRack(tx, orderId, 'REMOVED', ctx.userId);
      if (!released) throw badRequest('NOT_ON_RACK', 'This order is not on a rack.');
      await this.audit.log(tx, ctx, {
        action: AuditAction.RACK_REMOVED,
        entityType: 'Order',
        entityId: orderId,
        metadata: { orderNumber: order.orderNumber, rack: released.rackName, slot: released.slotCode },
      });
      return { ok: true };
    });
  }

  /** Row-locks the slot so two counters can't fill the last space at once. */
  private async lockSlot(tx: TenantTx, tenantId: string, slotId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "RackSlot" WHERE id = ${slotId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    if (!rows.length) throw notFound('Rack slot');
    return tx.rackSlot.findFirstOrThrow({
      where: { id: slotId },
      include: { rack: { select: { name: true, storeId: true, isActive: true } } },
    });
  }
}
