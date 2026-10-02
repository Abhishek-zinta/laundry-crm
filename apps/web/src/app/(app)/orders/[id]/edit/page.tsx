'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api-client';
import { useOrder } from '@/features/orders/api';
import { PosScreen } from '@/features/pos/pos-screen';

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, error, refetch, isLoading } = useOrder(id);

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (!order) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (!order.workflow.canEditItems) {
    return (
      <EmptyState
        title="Items can no longer be changed"
        description="Items are locked once processing starts. You can still change the due date, notes and discount from the order page."
        action={
          <Button asChild variant="outline">
            <Link href={`/orders/${order.id}`}>Back to order</Link>
          </Button>
        }
      />
    );
  }
  return <PosScreen editOrder={order} />;
}
