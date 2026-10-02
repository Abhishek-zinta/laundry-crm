'use client';

import { CommandPaletteProvider } from '@/components/app/command-palette';
import { Header } from '@/components/app/header';
import { LogoMark } from '@/components/app/logo';
import { Sidebar } from '@/components/app/sidebar';
import { ErrorState } from '@/components/shared/empty-state';
import { errorMessage } from '@/lib/api-client';
import { SessionProvider, useMeQuery } from '@/lib/session';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: me, error, refetch, isLoading } = useMeQuery();

  if (isLoading || (!me && !error)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark className="size-9 animate-pulse" />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <SessionProvider me={me}>
      <CommandPaletteProvider>
        <Sidebar />
        <div className="flex min-h-dvh flex-col lg:pl-60">
          <Header />
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-6">{children}</main>
        </div>
      </CommandPaletteProvider>
    </SessionProvider>
  );
}
