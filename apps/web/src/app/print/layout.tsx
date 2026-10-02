'use client';

import { LogoMark } from '@/components/app/logo';
import { ErrorState } from '@/components/shared/empty-state';
import { errorMessage } from '@/lib/api-client';
import { SessionProvider, useMeQuery } from '@/lib/session';

/** Bare layout for printable documents (no app chrome). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  const { data: me, error, refetch } = useMeQuery();
  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <LogoMark className="size-9 animate-pulse" />
        )}
      </div>
    );
  }
  return (
    <SessionProvider me={me}>
      <div className="min-h-dvh bg-slate-100 print:bg-white">{children}</div>
    </SessionProvider>
  );
}
