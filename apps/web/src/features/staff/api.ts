'use client';

import type { CreateStaffInput, StaffDto, UpdateStaffInput } from '@rinseops/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export const staffKeys = { all: ['staff'] as const };

export function useStaff() {
  return useQuery({ queryKey: staffKeys.all, queryFn: ({ signal }) => apiGet<StaffDto[]>('/staff', signal) });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => apiPost<StaffDto>('/staff', input as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpdateStaffInput> }) =>
      apiPatch<StaffDto>(`/staff/${id}`, input as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKeys.all });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
