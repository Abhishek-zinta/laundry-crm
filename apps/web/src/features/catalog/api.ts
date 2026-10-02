'use client';

import type {
  CatalogOverview,
  CreateModifierInput,
  CreatePriceListInput,
  CreateServiceCategoryInput,
  CreateServiceItemInput,
  PriceMatrixDto,
  UpdateModifierInput,
  UpdatePriceListInput,
  UpdateServiceCategoryInput,
  UpdateServiceItemInput,
  UpsertPriceListItemsInput,
} from '@rinseops/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';

export const catalogKeys = {
  overview: ['catalog', 'overview'] as const,
  matrix: (id: string) => ['catalog', 'matrix', id] as const,
};

export function useCatalogOverview() {
  return useQuery({
    queryKey: catalogKeys.overview,
    queryFn: ({ signal }) => apiGet<CatalogOverview>('/catalog', signal),
  });
}

export function usePriceMatrix(id: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.matrix(id ?? ''),
    queryFn: ({ signal }) => apiGet<PriceMatrixDto>(`/catalog/price-lists/${id}`, signal),
    enabled: Boolean(id),
  });
}

function useCatalogMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      qc.invalidateQueries({ queryKey: ['pos-catalog'] });
    },
  });
}

type Body = Record<string, unknown>;

export const useCreateCategory = () =>
  useCatalogMutation((input: CreateServiceCategoryInput) => apiPost('/catalog/categories', input as Body));
export const useUpdateCategory = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpdateServiceCategoryInput }) =>
    apiPatch(`/catalog/categories/${id}`, input as Body),
  );
export const useCreateItem = () => useCatalogMutation((input: CreateServiceItemInput) => apiPost('/catalog/items', input as Body));
export const useUpdateItem = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpdateServiceItemInput }) => apiPatch(`/catalog/items/${id}`, input as Body));
export const useCreateModifier = () => useCatalogMutation((input: CreateModifierInput) => apiPost('/catalog/modifiers', input as Body));
export const useUpdateModifier = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpdateModifierInput }) => apiPatch(`/catalog/modifiers/${id}`, input as Body));
export const useCreatePriceList = () =>
  useCatalogMutation((input: CreatePriceListInput) => apiPost<{ id: string }>('/catalog/price-lists', input as Body));
export const useUpdatePriceList = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpdatePriceListInput }) => apiPatch(`/catalog/price-lists/${id}`, input as Body));
export const useUpsertPrices = () =>
  useCatalogMutation(({ id, input }: { id: string; input: UpsertPriceListItemsInput }) =>
    apiPut<PriceMatrixDto>(`/catalog/price-lists/${id}/prices`, input as unknown as Body),
  );

export function useSetDefaultPriceList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaultPriceListId: string) => apiPatch('/settings', { defaultPriceListId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      qc.invalidateQueries({ queryKey: ['pos-catalog'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
