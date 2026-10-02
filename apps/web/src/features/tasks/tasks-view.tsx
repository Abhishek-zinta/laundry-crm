'use client';

import { customerDisplayName, Permission, type TaskListItem } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { MapPin, Phone, Plus, Search, Truck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { TaskStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat, type Formatters } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useDebouncedValue } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { useTasks } from './api';
import { CreateTaskDialog } from './create-task-dialog';
import { TaskActions } from './task-actions';
import { TaskSourceBadge, TaskTypeBadge } from './task-type-badge';

const SCOPES = [
  { key: 'open', label: 'Open' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
] as const;

const PAGE_SIZE = 25;

export function TasksView() {
  const { can, storeFilter } = useSession();
  const f = useFormat();
  const [state, setState] = useUrlState({ scope: 'open', type: '', q: '', page: '1' });
  const [search, setSearch] = useState(state.q ?? '');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (debounced !== (state.q ?? '')) setState({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Math.max(1, Number(state.page) || 1);
  const query = useTasks({
    scope: state.scope,
    type: state.type || undefined,
    q: state.q || undefined,
    storeId: storeFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = query.data?.items;

  const columns: ColumnDef<TaskListItem>[] = [
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{f.calendarDate(row.original.scheduledDate)}</p>
          <p className="tabular text-xs text-muted-foreground">{row.original.timeSlot}</p>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <TaskTypeBadge type={row.original.type} />
          <TaskSourceBadge source={row.original.source} />
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/customers/${row.original.customer.id}`} className="font-medium hover:underline">
            {customerDisplayName(row.original.customer)}
          </Link>
          <a
            href={`tel:${row.original.customer.phone}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Phone className="size-3" />
            {row.original.customer.phone}
          </a>
        </div>
      ),
    },
    {
      id: 'address',
      header: 'Address',
      meta: { hideOnMobile: true, className: 'whitespace-normal' },
      cell: ({ row }) => (
        <div className="max-w-64">
          <p className="line-clamp-2 text-xs">{row.original.address}</p>
          {(row.original.requestedService || row.original.notes) && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {[row.original.requestedService, row.original.notes].filter(Boolean).join(' · ')}
            </p>
          )}
          {row.original.failureReason && <p className="mt-0.5 text-xs text-rose-600">Failed: {row.original.failureReason}</p>}
        </div>
      ),
    },
    {
      id: 'driver',
      header: 'Driver',
      meta: { hideOnMobile: true },
      cell: ({ row }) =>
        row.original.assignedDriver ? (
          <span className="text-sm">{row.original.assignedDriver.name}</span>
        ) : (
          <span className="text-xs text-amber-700">Unassigned</span>
        ),
    },
    {
      id: 'order',
      header: 'Order',
      meta: { hideOnMobile: true },
      cell: ({ row }) =>
        row.original.order ? (
          <Link href={`/orders/${row.original.order.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.order.orderNumber}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <TaskStatusBadge status={row.original.status} /> },
    { id: 'actions', header: '', meta: { align: 'right' }, cell: ({ row }) => <TaskActions task={row.original} /> },
  ];

  return (
    <>
      <PageHeader
        title="Pickups & Deliveries"
        description="Schedule pickups, assign drivers and turn collected clothes into orders."
        actions={
          can(Permission.TASKS_MANAGE) && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New pickup / delivery
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 [scrollbar-width:none]">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setState({ scope: s.key })}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                state.scope === s.key && 'bg-primary-soft text-primary hover:text-primary',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or address" className="pl-8" />
          </div>
          <NativeSelect aria-label="Type" className="w-auto" value={state.type ?? ''} onChange={(e) => setState({ type: e.target.value })}>
            <option value="">All types</option>
            <option value="PICKUP">Pickups</option>
            <option value="DELIVERY">Deliveries</option>
          </NativeSelect>
        </div>
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={items}
          loading={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          getRowId={(t) => t.id}
          empty={<TasksEmpty scope={state.scope ?? 'open'} />}
          pagination={
            query.data
              ? {
                  page,
                  pageSize: PAGE_SIZE,
                  total: query.data.total,
                  onPageChange: (p) => setState({ page: String(p) }, { resetPage: false }),
                }
              : undefined
          }
        />
      </div>

      <div className="grid gap-2 md:hidden">
        {query.isLoading && !items ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)
        ) : query.error && !items ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : !items?.length ? (
          <div className="rounded-lg border bg-card">
            <TasksEmpty scope={state.scope ?? 'open'} />
          </div>
        ) : (
          items.map((t) => <TaskCard key={t.id} task={t} f={f} />)
        )}
        {query.data && query.data.total > page * PAGE_SIZE && (
          <Button variant="outline" onClick={() => setState({ page: String(page + 1) }, { resetPage: false })}>
            Next page
          </Button>
        )}
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function TasksEmpty({ scope }: { scope: string }) {
  return (
    <EmptyState
      icon={Truck}
      title={scope === 'completed' ? 'No completed tasks yet' : 'No pickups or deliveries here'}
      description="Online bookings and tasks you schedule will show up here."
      compact
    />
  );
}

function TaskCard({ task, f }: { task: TaskListItem; f: Formatters }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskTypeBadge type={task.type} />
          <TaskSourceBadge source={task.source} />
          <TaskStatusBadge status={task.status} />
        </div>
        <div className="text-right text-xs">
          <p className="font-medium">{f.calendarDate(task.scheduledDate)}</p>
          <p className="tabular text-muted-foreground">{task.timeSlot}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Link href={`/customers/${task.customer.id}`} className="truncate font-medium">
          {customerDisplayName(task.customer)}
        </Link>
        <a href={`tel:${task.customer.phone}`} className="flex items-center gap-1 text-sm text-primary">
          <Phone className="size-3.5" />
          {task.customer.phone}
        </a>
      </div>
      <p className="mt-1 flex gap-1 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 size-3 shrink-0" />
        {task.address}
      </p>
      {(task.requestedService || task.notes) && (
        <p className="mt-1 text-xs">{[task.requestedService, task.notes].filter(Boolean).join(' · ')}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <span className="text-xs text-muted-foreground">
          {task.assignedDriver ? `Driver: ${task.assignedDriver.name}` : 'Unassigned'}
          {task.order && (
            <>
              {' · '}
              <Link href={`/orders/${task.order.id}`} className="font-mono text-primary">
                {task.order.orderNumber}
              </Link>
            </>
          )}
        </span>
        <TaskActions task={task} compact />
      </div>
    </div>
  );
}
