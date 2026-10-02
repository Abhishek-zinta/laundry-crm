import { Suspense } from 'react';
import { OrdersPage } from './orders-page';

export const metadata = { title: 'Orders' };

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
