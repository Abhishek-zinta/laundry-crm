'use client';

import type {
  AddressInput,
  CreateCustomerInput,
  CustomerDetail,
  CustomerListItem,
  OrderListItem,
  Paged,
  PaymentDto,
  UpdateCustomerInput,
} from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: Record<string, unknown>) => ['customers', 'list', params] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  payments: (id: string) => ['customers', 'payments', id] as const,
};

export function useCustomers(params: { q?: string; sort?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => apiGet<Paged<CustomerListItem>>(`/customers${toQuery(params)}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiGet<CustomerDetail>(`/customers/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useCustomerPayments(id: string, enabled = true) {
  return useQuery({
    queryKey: customerKeys.payments(id),
    queryFn: ({ signal }) =>
      apiGet<Array<PaymentDto & { order: { id: string; orderNumber: string } }>>(`/customers/${id}/payments`, signal),
    enabled,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => apiPost<CustomerDetail>('/customers', input as unknown as Record<string, unknown>),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      qc.setQueryData(customerKeys.detail(c.id), c);
    },
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCustomerInput) => apiPatch<CustomerDetail>(`/customers/${id}`, input as Record<string, unknown>),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      qc.setQueryData(customerKeys.detail(id), c);
    },
  });
}

export function useAddAddress(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => apiPost(`/customers/${customerId}/addresses`, input as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useRemoveAddress(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => apiDelete(`/customers/${customerId}/addresses/${addressId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useSetDefaultAddress(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => apiPatch(`/customers/${customerId}/addresses/${addressId}`, { isDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
  });
}

export function useCustomerOrders(customerId: string, page: number) {
  return useQuery({
    queryKey: ['orders', 'customer', customerId, page],
    queryFn: ({ signal }) =>
      apiGet<Paged<OrderListItem>>(`/orders${toQuery({ customerId, page, pageSize: 20, sort: 'createdAt', dir: 'desc' })}`, signal),
    placeholderData: keepPreviousData,
    enabled: Boolean(customerId),
  });
}
