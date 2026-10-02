'use client';

import type { AuditLogDto, CreateStoreInput, Paged, StoreDto, UpdateStoreInput, UpdateTenantInput } from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTenantInput) => apiPatch('/settings', input as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}

export function useStoresAdmin() {
  return useQuery({
    queryKey: ['stores', 'admin'],
    queryFn: ({ signal }) => apiGet<StoreDto[]>('/stores?includeInactive=true', signal),
  });
}

function useStoreMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stores'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export const useCreateStore = () =>
  useStoreMutation((input: CreateStoreInput) => apiPost<StoreDto>('/stores', input as Record<string, unknown>));
export const useUpdateStore = () =>
  useStoreMutation(({ id, input }: { id: string; input: UpdateStoreInput }) =>
    apiPatch<StoreDto>(`/stores/${id}`, input as Record<string, unknown>),
  );

export function useAuditLog(page: number) {
  return useQuery({
    queryKey: ['audit', page],
    queryFn: ({ signal }) => apiGet<Paged<AuditLogDto>>(`/audit${toQuery({ page, pageSize: 50 })}`, signal),
    placeholderData: keepPreviousData,
  });
}
