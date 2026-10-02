import { allowedTaskTransitions, type TaskListItem, type TaskStatus } from '@rinseops/shared';

export const STATUS_ACTION_LABEL: Record<TaskStatus, string> = {
  SCHEDULED: 'Move back to scheduled',
  ASSIGNED: 'Mark assigned',
  OUT_FOR_PICKUP: 'Start pickup',
  PICKED_UP: 'Mark picked up',
  OUT_FOR_DELIVERY: 'Start delivery',
  DELIVERED: 'Mark delivered',
  FAILED: 'Mark failed',
  CANCELLED: 'Cancel task',
};

/** Statuses that need a short reason from the user. */
export const NEEDS_REASON: TaskStatus[] = ['FAILED', 'CANCELLED'];

export function statusActions(task: Pick<TaskListItem, 'type' | 'status' | 'assignedDriverId'>): TaskStatus[] {
  return allowedTaskTransitions(task.type, task.status).filter(
    // ASSIGNED is reached through the assign action, not a bare status change.
    (s) => !(s === 'ASSIGNED'),
  );
}

export function canCreateOrderFromTask(task: Pick<TaskListItem, 'type' | 'status' | 'orderId'>): boolean {
  return task.type === 'PICKUP' && !task.orderId && task.status !== 'CANCELLED' && task.status !== 'FAILED';
}
