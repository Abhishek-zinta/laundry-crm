'use client';

import { COMPLETED_TASK_STATUSES, customerDisplayName, type TaskListItem, type TaskStatus } from '@rinseops/shared';
import { ChevronDown, Clock, MapPin, Navigation, Phone, RefreshCw, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { TaskStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { mapsUrl, useChangeTaskStatus, useMyTasks } from './api';
import { TaskTypeBadge } from './task-type-badge';

interface DriverAction {
  status: TaskStatus;
  label: string;
  variant: 'default' | 'outline' | 'destructive';
  confirm?: boolean;
  reason?: boolean;
}

function actionsFor(task: TaskListItem): DriverAction[] {
  const pickup = task.type === 'PICKUP';
  switch (task.status) {
    case 'SCHEDULED':
    case 'ASSIGNED':
      return [{ status: pickup ? 'OUT_FOR_PICKUP' : 'OUT_FOR_DELIVERY', label: 'Start', variant: 'default' }];
    case 'OUT_FOR_PICKUP':
      return [
        { status: 'PICKED_UP', label: 'Picked up', variant: 'default', confirm: true },
        { status: 'FAILED', label: 'Failed', variant: 'outline', confirm: true, reason: true },
      ];
    case 'OUT_FOR_DELIVERY':
      return [
        { status: 'DELIVERED', label: 'Delivered', variant: 'default', confirm: true },
        { status: 'FAILED', label: 'Failed', variant: 'outline', confirm: true, reason: true },
      ];
    default:
      return [];
  }
}

export function DriverView() {
  const f = useFormat();
  const query = useMyTasks();
  const [showDone, setShowDone] = useState(false);
  const items = query.data?.items ?? [];
  const done = items.filter((t) => (COMPLETED_TASK_STATUSES as readonly string[]).includes(t.status) || t.status === 'CANCELLED');
  const active = items.filter((t) => !done.includes(t));
  const pickups = active.filter((t) => t.type === 'PICKUP').length;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Today&apos;s tasks</h1>
          <p className="text-sm text-muted-foreground">
            {query.data ? f.calendarDate(query.data.date) : '…'}
            {query.data &&
              ` · ${active.length} to do (${pickups} pickup${pickups === 1 ? '' : 's'}, ${active.length - pickups} deliver${active.length - pickups === 1 ? 'y' : 'ies'}) · ${done.length} done`}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void query.refetch()} aria-label="Refresh">
          <RefreshCw className={cn(query.isFetching && 'animate-spin')} />
        </Button>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : active.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Truck}
            title={done.length ? 'All done for today' : 'No tasks assigned for today'}
            description="New tasks will appear here automatically."
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {active.map((t) => (
            <DriverTaskCard key={t.id} task={t} today={query.data?.date} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground"
          >
            Done today ({done.length})
            <ChevronDown className={cn('size-4 transition-transform', showDone && 'rotate-180')} />
          </button>
          {showDone && (
            <div className="grid gap-2">
              {done.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customerDisplayName(t.customer)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.type === 'PICKUP' ? 'Pickup' : 'Delivery'} · {t.timeSlot}
                      {t.completedAt && ` · ${f.time(t.completedAt)}`}
                    </p>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DriverTaskCard({ task, today }: { task: TaskListItem; today?: string }) {
  const f = useFormat();
  const change = useChangeTaskStatus();
  const [pending, setPending] = useState<DriverAction | null>(null);
  const actions = actionsFor(task);
  const overdue = today && task.scheduledDate < today;

  const run = (action: DriverAction, note?: string) =>
    change.mutate(
      { id: task.id, status: action.status, note },
      {
        onSuccess: () => {
          setPending(null);
          toast.success(`Marked ${action.label.toLowerCase()}`);
        },
        onError: (err) => toast.error(errorMessage(err, "We couldn't update this task. Please try again.")),
      },
    );

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b bg-slate-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TaskTypeBadge type={task.type} />
          <span className={cn('flex items-center gap-1 text-sm font-medium', overdue && 'text-rose-600')}>
            <Clock className="size-3.5" />
            {overdue ? `${f.calendarDate(task.scheduledDate)} · ` : ''}
            {task.timeSlot}
          </span>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight">{customerDisplayName(task.customer)}</p>
            <p className="tabular text-sm text-muted-foreground">{task.customer.phone}</p>
          </div>
          <Button asChild size="lg" variant="soft" className="h-12 shrink-0 px-4">
            <a href={`tel:${task.customer.phone}`}>
              <Phone />
              Call
            </a>
          </Button>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{task.address}</p>
            <a
              href={mapsUrl(task.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              <Navigation className="size-3.5" />
              Open in Maps
            </a>
          </div>
        </div>
        {(task.requestedService || task.notes) && (
          <div className="text-sm">
            {task.requestedService && <p className="font-medium">{task.requestedService}</p>}
            {task.notes && <p className="whitespace-pre-line text-muted-foreground">{task.notes}</p>}
          </div>
        )}
        {task.order && (
          <p className="text-sm">
            Order <span className="font-mono font-medium">{task.order.orderNumber}</span> · {task.order.totalPieces} pieces
            {Number(task.order.balanceDue) > 0 && <span className="text-rose-600"> · collect {f.money(task.order.balanceDue)}</span>}
          </p>
        )}
        {task.failureReason && <p className="text-sm text-rose-600">Last attempt failed: {task.failureReason}</p>}
        {actions.length > 0 && (
          <div className={cn('grid gap-2', actions.length > 1 ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1')}>
            {actions.map((a) => (
              <Button
                key={a.status}
                size="xl"
                variant={a.variant}
                loading={change.isPending && !a.confirm && change.variables?.status === a.status}
                onClick={() => (a.confirm ? setPending(a) : run(a))}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `Mark as ${pending.label.toLowerCase()}?` : ''}
        description={`${customerDisplayName(task.customer)} · ${task.timeSlot}`}
        confirmLabel={pending?.label ?? 'Confirm'}
        destructive={pending?.status === 'FAILED'}
        loading={change.isPending}
        reason={
          pending?.reason
            ? { label: 'What happened?', placeholder: 'e.g. Customer not home, no answer on call', required: true }
            : undefined
        }
        onConfirm={(note) => {
          if (pending) run(pending, note);
        }}
      />
    </article>
  );
}
