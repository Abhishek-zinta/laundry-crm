'use client';

import { PosScreen } from '@/features/pos/pos-screen';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export function NewOrderPage({ customerId, taskId }: { customerId?: string; taskId?: string }) {
  return (
    <PosScreen
      key={`${customerId ?? ''}:${taskId ?? ''}`}
      initialCustomerId={customerId && UUID_RE.test(customerId) ? customerId : undefined}
      pickupTaskId={taskId && UUID_RE.test(taskId) ? taskId : undefined}
    />
  );
}
