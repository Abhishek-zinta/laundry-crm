'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Keeps list filters in the URL so they survive navigation to a detail page
 * and back (and can be shared). Requires a <Suspense> boundary above.
 */
export function useUrlState<T extends Record<string, string | undefined>>(defaults: T) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo(() => {
    const out = { ...defaults } as Record<string, string | undefined>;
    for (const key of Object.keys(defaults)) {
      const v = params.get(key);
      if (v !== null) out[key] = v;
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback(
    (patch: Partial<T>, opts: { resetPage?: boolean } = { resetPage: true }) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === defaults[k]) sp.delete(k);
        else sp.set(k, String(v));
      }
      if (opts.resetPage && !('page' in patch)) sp.delete('page');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, pathname, router],
  );

  return [state, set] as const;
}
