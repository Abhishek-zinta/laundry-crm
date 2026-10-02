import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  loading?: boolean;
}

const toneClass = {
  default: 'bg-primary-soft text-primary',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-600',
  success: 'bg-emerald-50 text-emerald-700',
};

export function StatCard({ label, value, hint, icon: Icon, href, tone = 'default', loading }: StatCardProps) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className="tabular mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
        )}
        {hint && !loading && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', toneClass[tone])}>
          <Icon className="size-4" />
        </span>
      )}
    </div>
  );
  const cls = 'block rounded-lg border bg-card p-4 shadow-xs';
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        'transition-colors hover:border-primary/40 hover:bg-slate-50/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
