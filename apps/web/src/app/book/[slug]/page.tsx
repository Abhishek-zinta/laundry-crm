import type { Metadata } from 'next';
import { BookingView } from '@/features/booking/booking-view';

export const metadata: Metadata = {
  title: 'Book a pickup',
  description: 'Schedule a laundry and dry-cleaning pickup in under a minute.',
};

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BookingView slug={slug} />;
}
