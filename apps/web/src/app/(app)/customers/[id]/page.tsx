import { CustomerProfile } from './customer-profile';

export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfile id={id} />;
}
