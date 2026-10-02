import { Suspense } from 'react';
import { GarmentsScreen } from '@/features/garments/garments-screen';

export const metadata = { title: 'Garments' };

export default function Page() {
  return (
    <Suspense>
      <GarmentsScreen />
    </Suspense>
  );
}
