'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogoMark } from '@/components/app/logo';
import { useMeQuery } from '@/lib/session';

/** Sends each role to its home screen (dashboard, POS, garments or driver tasks). */
export default function Home() {
  const router = useRouter();
  const { data, error } = useMeQuery();
  useEffect(() => {
    if (data) router.replace(data.home);
    else if (error) router.replace('/login');
  }, [data, error, router]);
  return (
    <div className="grid min-h-dvh place-items-center">
      <LogoMark className="size-9 animate-pulse" />
    </div>
  );
}
