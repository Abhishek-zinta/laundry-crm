'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PrintToolbar({ backHref, children }: { backHref: string; children?: React.ReactNode }) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft />
          Back to order
        </Link>
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>
    </div>
  );
}

export function SegmentedLinks({ options, value }: { options: Array<{ value: string; label: string; href: string }>; value: string }) {
  return (
    <div className="flex rounded-md border p-0.5 text-xs">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          replace
          className={
            o.value === value
              ? 'rounded bg-slate-900 px-2.5 py-1 font-medium text-white'
              : 'px-2.5 py-1 text-muted-foreground hover:text-foreground'
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
