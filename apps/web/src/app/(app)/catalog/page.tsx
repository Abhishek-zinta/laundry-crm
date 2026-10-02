import { Suspense } from 'react';
import { CatalogScreen } from '@/features/catalog/catalog-screen';

export const metadata = { title: 'Services & Pricing' };

export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogScreen />
    </Suspense>
  );
}
