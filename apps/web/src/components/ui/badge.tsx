import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium leading-4 [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-slate-200 bg-slate-50 text-slate-700',
        blue: 'border-sky-200 bg-sky-50 text-sky-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        violet: 'border-violet-200 bg-violet-50 text-violet-700',
        green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        red: 'border-rose-200 bg-rose-50 text-rose-700',
        teal: 'border-teal-200 bg-teal-50 text-teal-800',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export function Badge({ className, tone, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
