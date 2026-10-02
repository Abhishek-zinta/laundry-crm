import { Suspense } from 'react';
import { ReportsView } from './reports-view';

export const metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
