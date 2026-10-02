'use client';

import type { PaymentList, PaymentMethod } from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

export interface PaymentListParams {
  from?: string;
  to?: string;
  method?: PaymentMethod;
  storeId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: ['payments', 'list', params],
    queryFn: ({ signal }) => apiGet<PaymentList>(`/payments${toQuery({ ...params })}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiPost(`/payments/${id}/refund`, { reason }),
    onSuccess: () => {
      for (const key of ['payments', 'orders', 'dashboard', 'customers']) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
