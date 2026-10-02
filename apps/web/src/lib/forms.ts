'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type Path, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ApiError } from './api-client';

/** react-hook-form wired to a shared Zod schema (same rules as the API). */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  options?: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, 'resolver'>,
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    ...options,
    resolver: zodResolver(schema as never) as never,
  });
}

/**
 * Shows an API error on matching form fields when possible, otherwise as a toast.
 */
export function applyApiError<T extends FieldValues>(form: UseFormReturn<T, unknown, unknown> | null, err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const fields = err.fields;
    let applied = false;
    if (form) {
      for (const [key, message] of Object.entries(fields)) {
        form.setError(key as Path<T>, { message });
        applied = true;
      }
    }
    if (!applied) toast.error(err.message || fallback);
    return;
  }
  toast.error(fallback);
}
