'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeDto, Permission } from '@rinseops/shared';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiGet, apiPost } from './api-client';

const STORE_KEY = 'rinseops.storeId';
export const ALL_STORES = 'all';

interface SessionValue {
  me: MeDto;
  can: (permission: Permission) => boolean;
  /** Selected store id, or "all" (only when the user has more than one store). */
  storeId: string;
  /** A concrete store for actions that need one (POS, racks). */
  activeStoreId: string;
  setStoreId: (id: string) => void;
  /** Store filter for list queries (undefined = all accessible stores). */
  storeFilter: string | undefined;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useMeQuery() {
  return useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => apiGet<MeDto>('/auth/me', signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function SessionProvider({ me, children }: { me: MeDto; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const stores = me.stores;
  // Restore the last selected store. SessionProvider only renders in the
  // browser (after /auth/me resolves), so localStorage is available here.
  const [storeId, setStoreIdState] = useState<string>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORE_KEY) : null;
      if (saved && (saved === ALL_STORES ? stores.length > 1 : stores.some((s) => s.id === saved))) return saved;
    } catch {
      /* storage unavailable */
    }
    return stores[0]?.id ?? ALL_STORES;
  });

  const setStoreId = useCallback((id: string) => {
    setStoreIdState(id);
    try {
      window.localStorage.setItem(STORE_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } finally {
      queryClient.clear();
      // Full reload so no tenant data survives in memory after logout.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    const perms = new Set(me.permissions);
    const validStore = storeId === ALL_STORES || stores.some((s) => s.id === storeId) ? storeId : (stores[0]?.id ?? ALL_STORES);
    return {
      me,
      can: (p) => perms.has(p),
      storeId: validStore,
      activeStoreId: validStore === ALL_STORES ? (stores[0]?.id ?? '') : validStore,
      setStoreId,
      storeFilter: validStore === ALL_STORES ? undefined : validStore,
      logout,
    };
  }, [me, storeId, stores, setStoreId, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Session if available (for components that also render on public pages). */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}
