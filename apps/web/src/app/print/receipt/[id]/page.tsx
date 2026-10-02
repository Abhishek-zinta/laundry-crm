import { ReceiptPage, type ReceiptFormat } from '@/features/print/receipt';

export const metadata = { title: 'Receipt' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string; autoprint?: string }>;
}) {
  const { id } = await params;
  const { format, autoprint } = await searchParams;
  const fmt: ReceiptFormat = format === 'a4' ? 'a4' : 'thermal';
  return <ReceiptPage id={id} format={fmt} autoPrint={autoprint === '1'} />;
}
