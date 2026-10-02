import { Suspense } from 'react';
import { OrderDetailView } from '@/features/orders/order-detail';

export const metadata = { title: 'Order' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <OrderDetailView id={id} />
    </Suspense>
  );
}
