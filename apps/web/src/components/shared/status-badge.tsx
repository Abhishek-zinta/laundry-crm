import {
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type OrderPaymentStatus,
  type OrderStatus,
  type PaymentStatus,
  type TaskStatus,
} from '@rinseops/shared';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Consistent colours for workflow states across the whole app. */
export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  RECEIVED: 'blue',
  PROCESSING: 'amber',
  QUALITY_CHECK: 'violet',
  READY: 'green',
  DELIVERED: 'neutral',
  CANCELLED: 'red',
};

export const ORDER_STATUS_DOT: Record<OrderStatus, string> = {
  RECEIVED: 'bg-sky-500',
  PROCESSING: 'bg-amber-500',
  QUALITY_CHECK: 'bg-violet-500',
  READY: 'bg-emerald-500',
  DELIVERED: 'bg-slate-400',
  CANCELLED: 'bg-rose-500',
};

const PAYMENT_TONE: Record<OrderPaymentStatus, BadgeTone> = { UNPAID: 'red', PARTIAL: 'amber', PAID: 'green' };
const LEDGER_TONE: Record<PaymentStatus, BadgeTone> = { PENDING: 'amber', COMPLETED: 'green', FAILED: 'red', REFUNDED: 'neutral' };

export const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  SCHEDULED: 'neutral',
  ASSIGNED: 'blue',
  OUT_FOR_PICKUP: 'amber',
  OUT_FOR_DELIVERY: 'amber',
  PICKED_UP: 'green',
  DELIVERED: 'green',
  FAILED: 'red',
  CANCELLED: 'outline',
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} className={className}>
      <span className={cn('size-1.5 rounded-full', ORDER_STATUS_DOT[status])} />
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PaymentBadge({ status, className }: { status: OrderPaymentStatus; className?: string }) {
  return (
    <Badge tone={PAYMENT_TONE[status]} className={className}>
      {ORDER_PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function LedgerStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={LEDGER_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>;
}
