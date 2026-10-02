'use client';

import type { BulkGarmentResult, GarmentDetail, GarmentList, OrderStatus, updateGarmentSchema } from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';
import { invalidateOrderData } from '../orders/api';

export function useGarments(params: {
  q?: string;
  status?: string;
  storeId?: string;
  hasIssues?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['garments', 'list', params],
    queryFn: ({ signal }) => apiGet<GarmentList>(`/garments${toQuery(params)}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function useGarmentByTag(tag: string | null) {
  return useQuery({
    queryKey: ['garments', 'tag', tag],
    queryFn: ({ signal }) => apiGet<GarmentDetail>(`/garments/tag/${encodeURIComponent(tag!)}`, signal),
    enabled: Boolean(tag),
    retry: false,
  });
}

export function useUpdateGarment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: z.input<typeof updateGarmentSchema>) =>
      apiPatch<GarmentDetail>(`/garments/${id}`, input as Record<string, unknown>),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function useGarmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      apiPost<GarmentDetail>(`/garments/${id}/status`, { status, note }),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function useBulkGarmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tagCodes: string[]; status: OrderStatus; note?: string }) =>
      apiPost<BulkGarmentResult>('/garments/bulk-status', input),
    onSuccess: () => invalidateOrderData(qc),
  });
}
