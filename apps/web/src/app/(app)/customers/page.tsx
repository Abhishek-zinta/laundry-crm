import { Suspense } from 'react';
import { CustomersView } from './customers-view';

export const metadata = { title: 'Customers' };

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}
