import { TagsPage, type TagLayout } from '@/features/print/tags';

export const metadata = { title: 'Garment tags' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { id } = await params;
  const { layout } = await searchParams;
  const value: TagLayout = layout === 'sheet' ? 'sheet' : 'roll';
  return <TagsPage id={id} layout={value} />;
}
