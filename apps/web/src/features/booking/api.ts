'use client';

import type { PublicBookingInput, PublicTenantProfile } from '@rinseops/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';

export interface BookingConfirmation {
  reference: string;
  pickupDate: string;
  timeSlot: string;
  storeName?: string;
}

export function usePublicProfile(slug: string) {
  return useQuery({
    queryKey: ['public', 'tenant', slug],
    queryFn: ({ signal }) => apiGet<PublicTenantProfile>(`/public/tenants/${encodeURIComponent(slug)}`, signal),
    staleTime: 5 * 60_000,
  });
}

export function useCreateBooking(slug: string) {
  return useMutation({
    mutationFn: (input: PublicBookingInput) =>
      apiPost<BookingConfirmation>(`/public/tenants/${encodeURIComponent(slug)}/bookings`, input as unknown as Record<string, unknown>),
  });
}
