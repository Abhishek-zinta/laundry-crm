import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssignTaskInput,
  AuditAction,
  canTransitionTask,
  ChangeTaskStatusInput,
  COMPLETED_TASK_STATUSES,
  CreateTaskInput,
  dateKeyInZone,
  OPEN_TASK_STATUSES,
  OrderStatus,
  Permission,
  phoneDigits,
  TASK_STATUS_LABEL,
  TaskListQuery,
  TaskStatus,
  TaskType,
  toDecimal,
  UpdateTaskInput,
} from '@rinseops/shared';
import { AuthContext, assertStoreAccess, hasPermission, storeScope } from '../../common/auth/auth-context';
import { AuditService } from '../../common/audit/audit.service';
import { AppError, badRequest, forbidden, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dateFromKey, dateKey, money } from '../../common/util/serialize';
import { loadTenantSettings } from '../../common/util/tenant-settings';
import { lockOrder } from '../payments/ledger';
import { WorkflowService } from '../workflow/workflow.service';
import { formatAddress } from './address-format';

const TASK_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, alternatePhone: true } },
  store: { select: { id: true, name: true } },
  assignedDriver: { select: { id: true, name: true, phone: true } },
  order: { select: { id: true, orderNumber: true, status: true, balanceDue: true, totalPieces: true } },
} satisfies Prisma.PickupDeliveryTaskInclude;

type TaskRow = Prisma.PickupDeliveryTaskGetPayload<{ include: typeof TASK_INCLUDE }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workflow: WorkflowService,
  ) {}

  async list(ctx: AuthContext, query: TaskListQuery) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const today = dateFromKey(dateKeyInZone(new Date(), settings.timezone));

    const and: Prisma.PickupDeliveryTaskWhereInput[] = [];
    if (hasPermission(ctx, Permission.TASKS_VIEW_ALL)) {
      and.push(storeScope(ctx, query.storeId));
      if (query.driverId) and.push({ assignedDriverId: query.driverId });
    } else {
      and.push({ assignedDriverId: ctx.userId });
    }
    if (query.type) and.push({ type: query.type });
    if (query.status) and.push({ status: query.status });
    if (query.date) and.push({ scheduledDate: dateFromKey(query.date) });
    switch (query.scope) {
      case 'open':
        and.push({ status: { in: [...OPEN_TASK_STATUSES, TaskStatus.FAILED] } });
        break;
      case 'today':
        and.push({ scheduledDate: today });
        break;
      case 'upcoming':
        and.push({ scheduledDate: { gt: today }, status: { in: [...OPEN_TASK_STATUSES] } });
        break;
      case 'completed':
        and.push({ status: { in: [...COMPLETED_TASK_STATUSES] } });
        break;
    }
    if (query.q) {
      const digits = phoneDigits(query.q);
      and.push({
        OR: [
          { customer: { firstName: { contains: query.q, mode: 'insensitive' } } },
          { customer: { lastName: { contains: query.q, mode: 'insensitive' } } },
          { address: { contains: query.q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
        ],
      });
    }

    const where = { AND: and };
    const [rows, total] = await Promise.all([
      db.pickupDeliveryTask.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ scheduledDate: query.scope === 'completed' ? 'desc' : 'asc' }, { timeSlot: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.pickupDeliveryTask.count({ where }),
    ]);
    return { items: rows.map(serializeTask), total, page: query.page, pageSize: query.pageSize };
  }

  /** Driver home: today's assigned tasks plus anything still open from earlier days. */
  async myTasks(ctx: AuthContext, date?: string) {
    const settings = await loadTenantSettings(this.prisma, ctx.tenantId);
    const key = date ?? dateKeyInZone(new Date(), settings.timezone);
    const day = dateFromKey(key);
    const rows = await this.prisma.forTenant(ctx.tenantId).pickupDeliveryTask.findMany({
      where: {
        assignedDriverId: ctx.userId,
        OR: [{ scheduledDate: day }, { scheduledDate: { lt: day }, status: { in: [...OPEN_TASK_STATUSES] } }],
      },
      include: TASK_INCLUDE,
      orderBy: [{ scheduledDate: 'asc' }, { timeSlot: 'asc' }],
    });
    return { date: key, items: rows.map(serializeTask) };
  }

  async get(ctx: AuthContext, id: string) {
    const task = await this.prisma.forTenant(ctx.tenantId).pickupDeliveryTask.findFirst({ where: { id }, include: TASK_INCLUDE });
    if (!task) throw notFound('Task');
    this.assertCanView(ctx, task);
    return serializeTask(task);
  }

  async create(ctx: AuthContext, input: CreateTaskInput) {
    assertStoreAccess(ctx, input.storeId);
    const db = this.prisma.forTenant(ctx.tenantId);
    const customer = await db.customer.findFirst({ where: { id: input.customerId } });
    if (!customer) throw notFound('Customer');

    let address = input.address?.trim() ?? '';
    if (input.addressId) {
      const saved = await db.customerAddress.findFirst({ where: { id: input.addressId, customerId: input.customerId } });
      if (!saved) throw notFound('Address');
      address = formatAddress(saved);
    }
    if (input.orderId) {
      const order = await db.order.findFirst({ where: { id: input.orderId, customerId: input.customerId } });
      if (!order) throw notFound('Order');
      if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
        throw badRequest('ORDER_CLOSED', 'This order is already closed.');
      }
    }
    if (input.type === TaskType.DELIVERY && !input.orderId) {
      throw badRequest('DELIVERY_NEEDS_ORDER', 'Choose the order to deliver.');
    }
    if (input.assignedDriverId) await this.assertDriver(ctx, input.assignedDriverId);

    const task = await db.$transaction(async (tx) => {
      const created = await tx.pickupDeliveryTask.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          customerId: input.customerId,
          orderId: input.orderId ?? null,
          addressId: input.addressId ?? null,
          type: input.type,
          status: input.assignedDriverId ? TaskStatus.ASSIGNED : TaskStatus.SCHEDULED,
          source: 'STAFF',
          address,
          scheduledDate: dateFromKey(input.scheduledDate),
          timeSlot: input.timeSlot,
          assignedDriverId: input.assignedDriverId ?? null,
          requestedService: input.requestedService ?? null,
          notes: input.notes ?? null,
          createdById: ctx.userId,
        },
      });
      await this.audit.log(tx, ctx, {
        action: AuditAction.TASK_CREATED,
        entityType: 'PickupDeliveryTask',
        entityId: created.id,
        metadata: { type: created.type, scheduledDate: input.scheduledDate, timeSlot: input.timeSlot },
      });
      return created;
    });
    return this.get(ctx, task.id);
  }

  async update(ctx: AuthContext, id: string, input: UpdateTaskInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const task = await db.pickupDeliveryTask.findFirst({ where: { id } });
    if (!task) throw notFound('Task');
    assertStoreAccess(ctx, task.storeId);
    if ((COMPLETED_TASK_STATUSES as string[]).includes(task.status) || task.status === TaskStatus.CANCELLED) {
      throw badRequest('TASK_CLOSED', 'This task is already closed.');
    }
    await db.$transaction(async (tx) => {
      await tx.pickupDeliveryTask.update({
        where: { id },
        data: {
          scheduledDate: input.scheduledDate ? dateFromKey(input.scheduledDate) : undefined,
          timeSlot: input.timeSlot,
          address: input.address,
          notes: input.notes,
          requestedService: input.requestedService,
        },
      });
      await this.audit.log(tx, ctx, {
        action: AuditAction.TASK_UPDATED,
        entityType: 'PickupDeliveryTask',
        entityId: id,
        metadata: { fields: Object.keys(input) },
      });
    });
    return this.get(ctx, id);
  }

  async assign(ctx: AuthContext, id: string, input: AssignTaskInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const task = await db.pickupDeliveryTask.findFirst({ where: { id } });
    if (!task) throw notFound('Task');
    assertStoreAccess(ctx, task.storeId);
    const assignable: string[] = [TaskStatus.SCHEDULED, TaskStatus.ASSIGNED, TaskStatus.FAILED];
    if (!assignable.includes(task.status)) {
      throw badRequest(
        'TASK_IN_PROGRESS',
        `This task is ${TASK_STATUS_LABEL[task.status as TaskStatus].toLowerCase()} and can't be reassigned.`,
      );
    }
    if (input.driverId) await this.assertDriver(ctx, input.driverId);

    await db.$transaction(async (tx) => {
      await tx.pickupDeliveryTask.update({
        where: { id },
        data: {
          assignedDriverId: input.driverId,
          status: input.driverId ? TaskStatus.ASSIGNED : TaskStatus.SCHEDULED,
          failureReason: null,
        },
      });
      await this.audit.log(tx, ctx, {
        action: AuditAction.TASK_UPDATED,
        entityType: 'PickupDeliveryTask',
        entityId: id,
        metadata: { assignedDriverId: input.driverId, from: task.assignedDriverId },
      });
    });
    return this.get(ctx, id);
  }

  async changeStatus(ctx: AuthContext, id: string, input: ChangeTaskStatusInput) {
    const db = this.prisma.forTenant(ctx.tenantId);
    const task = await db.pickupDeliveryTask.findFirst({ where: { id } });
    if (!task) throw notFound('Task');
    this.assertCanView(ctx, task);
    const isManager = hasPermission(ctx, Permission.TASKS_MANAGE);
    if (!isManager && task.assignedDriverId !== ctx.userId) throw forbidden('This task is not assigned to you.');
    if (!isManager && (input.status === TaskStatus.CANCELLED || input.status === TaskStatus.SCHEDULED)) {
      throw forbidden('Ask a manager to cancel or reschedule this task.');
    }

    const from = task.status as TaskStatus;
    if (!canTransitionTask(task.type as TaskType, from, input.status)) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `A ${task.type.toLowerCase()} can't move from ${TASK_STATUS_LABEL[from]} to ${TASK_STATUS_LABEL[input.status]}.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (input.status === TaskStatus.FAILED && !input.note) {
      throw badRequest('FAILURE_REASON_REQUIRED', 'Please add a short note explaining what went wrong.');
    }
    if (input.status === TaskStatus.ASSIGNED && !task.assignedDriverId) {
      throw badRequest('DRIVER_REQUIRED', 'Assign a driver first.');
    }

    let orderNote: string | null = null;
    await db.$transaction(async (tx) => {
      const completed = (COMPLETED_TASK_STATUSES as string[]).includes(input.status);
      const updated = await tx.pickupDeliveryTask.updateMany({
        where: { id, status: from },
        data: {
          status: input.status,
          completedAt: completed ? new Date() : null,
          failureReason: input.status === TaskStatus.FAILED ? input.note : null,
          ...(input.note && input.status !== TaskStatus.FAILED ? { notes: task.notes ? `${task.notes}\n${input.note}` : input.note } : {}),
        },
      });
      if (updated.count !== 1) throw badRequest('TASK_CHANGED', 'This task was just updated. Refresh and try again.');

      // A completed delivery hands over a ready, fully paid order automatically.
      if (task.type === TaskType.DELIVERY && input.status === TaskStatus.DELIVERED && task.orderId) {
        await lockOrder(tx, ctx.tenantId, task.orderId);
        const order = await tx.order.findFirstOrThrow({ where: { id: task.orderId } });
        if (order.status === OrderStatus.READY && toDecimal(order.balanceDue.toString()).lessThanOrEqualTo(0)) {
          await this.workflow.applyTransition(tx, ctx, order, OrderStatus.DELIVERED, 'Delivered to customer by driver');
        } else if (order.status === OrderStatus.READY) {
          orderNote = 'Order still has a balance — mark it delivered after collecting payment.';
        }
      }

      await this.audit.log(tx, ctx, {
        action: AuditAction.TASK_STATUS_CHANGED,
        entityType: 'PickupDeliveryTask',
        entityId: id,
        metadata: { type: task.type, from, to: input.status, note: input.note ?? null },
      });
    });
    return { ...(await this.get(ctx, id)), notice: orderNote };
  }

  private assertCanView(ctx: AuthContext, task: { storeId: string; assignedDriverId: string | null }) {
    if (hasPermission(ctx, Permission.TASKS_VIEW_ALL)) {
      assertStoreAccess(ctx, task.storeId);
      return;
    }
    if (task.assignedDriverId !== ctx.userId) throw notFound('Task');
  }

  private async assertDriver(ctx: AuthContext, driverId: string) {
    const driver = await this.prisma.forTenant(ctx.tenantId).user.findFirst({ where: { id: driverId, role: 'DRIVER', status: 'ACTIVE' } });
    if (!driver) throw notFound('Driver');
  }
}

function serializeTask(t: TaskRow) {
  return {
    ...t,
    scheduledDate: dateKey(t.scheduledDate),
    order: t.order ? { ...t.order, balanceDue: money(t.order.balanceDue) } : null,
  };
}
