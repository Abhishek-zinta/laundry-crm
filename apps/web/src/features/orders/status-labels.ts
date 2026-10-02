import type { OrderStatus } from '@rinseops/shared';

/** Action wording for moving an order into a status. */
export const STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Back to received',
  PROCESSING: 'Start processing',
  QUALITY_CHECK: 'Send to quality check',
  READY: 'Mark ready',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
};

export const REWORK_LABEL = 'Send back for rework';
