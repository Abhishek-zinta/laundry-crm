import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">Couldn&apos;t load this</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
