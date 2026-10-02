import { Suspense } from 'react';
import { PaymentsView } from './payments-view';

export const metadata = { title: 'Payments' };

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsView />
    </Suspense>
  );
}
