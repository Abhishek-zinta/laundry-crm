'use client';

import type { createRackSchema, createRackSlotSchema, updateRackSchema, updateRackSlotSchema } from '@rinseops/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { apiPatch, apiPost } from '@/lib/api-client';

function useRackMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['racks'] }) });
}

export const useCreateRack = () =>
  useRackMutation((input: z.input<typeof createRackSchema>) => apiPost('/racks', input as Record<string, unknown>));

export const useUpdateRack = () =>
  useRackMutation(({ id, ...input }: z.input<typeof updateRackSchema> & { id: string }) => apiPatch(`/racks/${id}`, input));

export const useAddSlot = () =>
  useRackMutation(({ rackId, ...input }: z.input<typeof createRackSlotSchema> & { rackId: string }) =>
    apiPost(`/racks/${rackId}/slots`, input as Record<string, unknown>),
  );

export const useUpdateSlot = () =>
  useRackMutation(({ slotId, ...input }: z.input<typeof updateRackSlotSchema> & { slotId: string }) =>
    apiPatch(`/racks/slots/${slotId}`, input),
  );
