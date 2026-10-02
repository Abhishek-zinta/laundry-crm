'use client';

import type { CreateTaskInput, Paged, TaskListItem, TaskStatus, UpdateTaskInput } from '@rinseops/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { toQuery } from '@/lib/utils';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (params: Record<string, unknown>) => ['tasks', 'list', params] as const,
  mine: (date?: string) => ['tasks', 'mine', date ?? 'today'] as const,
};

export interface TaskListParams {
  scope?: string;
  type?: string;
  q?: string;
  storeId?: string;
  page?: number;
  pageSize?: number;
}

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: taskKeys.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => apiGet<Paged<TaskListItem>>(`/tasks${toQuery({ ...params })}`, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMyTasks(date?: string) {
  return useQuery({
    queryKey: taskKeys.mine(date),
    queryFn: ({ signal }) => apiGet<{ date: string; items: TaskListItem[] }>(`/tasks/mine${toQuery({ date })}`, signal),
    refetchInterval: 60_000,
  });
}

export function useDrivers(storeId?: string, enabled = true) {
  return useQuery({
    queryKey: ['staff', 'drivers', storeId ?? 'all'],
    queryFn: ({ signal }) =>
      apiGet<Array<{ id: string; name: string; phone: string | null }>>(`/staff/drivers${toQuery({ storeId })}`, signal),
    enabled,
    staleTime: 60_000,
  });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: taskKeys.all });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useChangeTaskStatus() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: TaskStatus; note?: string }) =>
      apiPost<TaskListItem>(`/tasks/${id}/status`, { status, ...(note ? { note } : {}) }),
    onSuccess: (task) => {
      invalidate();
      if (task.notice) toast.info(task.notice);
    },
  });
}

export function useAssignTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string | null }) => apiPost<TaskListItem>(`/tasks/${id}/assign`, { driverId }),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      apiPatch<TaskListItem>(`/tasks/${id}`, input as Record<string, unknown>),
    onSuccess: invalidate,
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiPost<TaskListItem>('/tasks', input as unknown as Record<string, unknown>),
    onSuccess: invalidate,
  });
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
