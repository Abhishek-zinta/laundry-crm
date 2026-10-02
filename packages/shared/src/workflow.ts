import { OrderStatus, TaskStatus, TaskType } from './enums';
import { Permission } from './permissions';

export interface WorkflowOptions {
  /** When true, orders may go straight from PROCESSING to READY. */
  skipQualityCheck?: boolean;
}

/** Ordered processing stages of the default workflow (terminal CANCELLED excluded). */
export const ORDER_STAGES: readonly OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.PROCESSING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

/** Statuses that count as "open" (work still pending or waiting for collection). */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.PROCESSING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY,
];

/** Statuses where the order is still being worked on. */
export const PENDING_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.QUALITY_CHECK];

const BASE_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.QUALITY_CHECK, OrderStatus.CANCELLED],
  // Quality check can send items back for rework.
  [OrderStatus.QUALITY_CHECK]: [OrderStatus.READY, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.DELIVERED, OrderStatus.PROCESSING],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function allowedOrderTransitions(from: OrderStatus, options: WorkflowOptions = {}): OrderStatus[] {
  const next = [...BASE_TRANSITIONS[from]];
  if (options.skipQualityCheck && from === OrderStatus.PROCESSING) {
    next.splice(1, 0, OrderStatus.READY);
  }
  return next;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, options: WorkflowOptions = {}): boolean {
  return allowedOrderTransitions(from, options).includes(to);
}

/** The primary "next step" for an order, used for one-click advance buttons. */
export function nextOrderStage(from: OrderStatus, options: WorkflowOptions = {}): OrderStatus | null {
  const allowed = allowedOrderTransitions(from, options).filter((s) => s !== OrderStatus.CANCELLED && stageIndex(s) > stageIndex(from));
  return allowed[0] ?? null;
}

export function stageIndex(status: OrderStatus): number {
  return ORDER_STAGES.indexOf(status);
}

/** Permission required to move an order into the target status. */
export function permissionForOrderTransition(to: OrderStatus): Permission {
  if (to === OrderStatus.DELIVERED) return Permission.ORDERS_DELIVER;
  if (to === OrderStatus.CANCELLED) return Permission.ORDERS_CANCEL;
  return Permission.ORDERS_PROCESS;
}

/**
 * Garments follow the same stages as orders but cannot be delivered or
 * cancelled individually — those follow the parent order.
 */
export function canTransitionGarment(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  const processing: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.QUALITY_CHECK, OrderStatus.READY];
  return processing.includes(from) && processing.includes(to);
}

// ---------------------------------------------------------------------------
// Pickup & delivery task workflow
// ---------------------------------------------------------------------------

const TASK_TRANSITIONS: Record<TaskType, Partial<Record<TaskStatus, readonly TaskStatus[]>>> = {
  [TaskType.PICKUP]: {
    [TaskStatus.SCHEDULED]: [TaskStatus.ASSIGNED, TaskStatus.OUT_FOR_PICKUP, TaskStatus.CANCELLED],
    [TaskStatus.ASSIGNED]: [TaskStatus.OUT_FOR_PICKUP, TaskStatus.SCHEDULED, TaskStatus.CANCELLED],
    [TaskStatus.OUT_FOR_PICKUP]: [TaskStatus.PICKED_UP, TaskStatus.FAILED],
    [TaskStatus.FAILED]: [TaskStatus.ASSIGNED, TaskStatus.SCHEDULED, TaskStatus.CANCELLED],
    [TaskStatus.PICKED_UP]: [],
    [TaskStatus.CANCELLED]: [],
  },
  [TaskType.DELIVERY]: {
    [TaskStatus.SCHEDULED]: [TaskStatus.ASSIGNED, TaskStatus.OUT_FOR_DELIVERY, TaskStatus.CANCELLED],
    [TaskStatus.ASSIGNED]: [TaskStatus.OUT_FOR_DELIVERY, TaskStatus.SCHEDULED, TaskStatus.CANCELLED],
    [TaskStatus.OUT_FOR_DELIVERY]: [TaskStatus.DELIVERED, TaskStatus.FAILED],
    [TaskStatus.FAILED]: [TaskStatus.ASSIGNED, TaskStatus.SCHEDULED, TaskStatus.CANCELLED],
    [TaskStatus.DELIVERED]: [],
    [TaskStatus.CANCELLED]: [],
  },
};

export function allowedTaskTransitions(type: TaskType, from: TaskStatus): TaskStatus[] {
  return [...(TASK_TRANSITIONS[type][from] ?? [])];
}

export function canTransitionTask(type: TaskType, from: TaskStatus, to: TaskStatus): boolean {
  return allowedTaskTransitions(type, from).includes(to);
}

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = [
  TaskStatus.SCHEDULED,
  TaskStatus.ASSIGNED,
  TaskStatus.OUT_FOR_PICKUP,
  TaskStatus.OUT_FOR_DELIVERY,
];

export const COMPLETED_TASK_STATUSES: readonly TaskStatus[] = [TaskStatus.PICKED_UP, TaskStatus.DELIVERED];
