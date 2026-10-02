import { NewOrderPage } from './new-order-page';

export const metadata = { title: 'New order' };

export default async function Page({ searchParams }: { searchParams: Promise<{ customerId?: string; taskId?: string }> }) {
  const { customerId, taskId } = await searchParams;
  return <NewOrderPage customerId={customerId} taskId={taskId} />;
}
