'use client';

import type {
  assignRackSchema,
  changeOrderStatusSchema,
  createOrderSchema,
  createPaymentSchema,
  OrderDetail,
  OrderListItem,
  Paged,
  PosCatalog,
  RackBoard,
  RecordPaymentResult,
  updateOrderSchema,
} from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

/** Request payloads use the schemas' input types (optional fields may be omitted). */
export type CreateOrderPayload = z.input<typeof createOrderSchema>;
export type UpdateOrderPayload = z.input<typeof updateOrderSchema>;
export type ChangeStatusPayload = z.input<typeof changeOrderStatusSchema>;
export type CreatePaymentPayload = z.input<typeof createPaymentSchema>;
export type AssignRackPayload = z.input<typeof assignRackSchema>;

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: Record<string, unknown>) => ['orders', 'list', params] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

/** Everything that can change when an order, payment or rack changes. */
export function invalidateOrderData(qc: QueryClient) {
  for (const key of [['orders'], ['dashboard'], ['customers'], ['racks'], ['garments'], ['payments'], ['search'], ['tasks']]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

export type OrderListParams = {
  q?: string;
  status?: string;
  paymentStatus?: string;
  storeId?: string;
  customerId?: string;
  quick?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
};

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => apiGet<Paged<OrderListItem>>(`/orders${toQuery(params)}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: ({ signal }) => apiGet<OrderDetail>(`/orders/${id}`, signal),
    enabled: Boolean(id),
  });
}

function useOrderMutation<TInput>(fn: (input: TInput) => Promise<OrderDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order);
      invalidateOrderData(qc);
    },
  });
}

export function useCreateOrder() {
  return useOrderMutation((input: CreateOrderPayload) => apiPost<OrderDetail>('/orders', input as unknown as Record<string, unknown>));
}

export function useUpdateOrder(id: string) {
  return useOrderMutation((input: UpdateOrderPayload) => apiPatch<OrderDetail>(`/orders/${id}`, input as Record<string, unknown>));
}

export function useChangeOrderStatus(id: string) {
  return useOrderMutation((input: ChangeStatusPayload) => apiPost<OrderDetail>(`/orders/${id}/status`, input as Record<string, unknown>));
}

export function useCancelOrder(id: string) {
  return useOrderMutation((reason: string) => apiPost<OrderDetail>(`/orders/${id}/cancel`, { reason }));
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentPayload) => apiPost<RecordPaymentResult>('/payments', input as unknown as Record<string, unknown>),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => apiPost(`/payments/${paymentId}/refund`, { reason }),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function useRackBoard(storeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['racks', 'board', storeId],
    queryFn: ({ signal }) => apiGet<RackBoard>(`/racks${toQuery({ storeId })}`, signal),
    enabled: enabled && Boolean(storeId),
  });
}

export function useAssignRack(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignRackPayload) =>
      apiPost<{ slotCode: string; rackName: string }>(`/orders/${orderId}/rack`, input as unknown as Record<string, unknown>),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function useRemoveFromRack(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/orders/${orderId}/rack`),
    onSuccess: () => invalidateOrderData(qc),
  });
}

export function usePosCatalog(params: { storeId?: string; customerId?: string; priceListId?: string }) {
  return useQuery({
    queryKey: ['pos-catalog', params],
    queryFn: ({ signal }) => apiGet<PosCatalog>(`/catalog/pos${toQuery(params)}`, signal),
    enabled: Boolean(params.storeId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
