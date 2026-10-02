'use client';

import {
  customerDisplayName,
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_PAYMENT_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  Permission,
  type OrderListItem,
  type OrderStatus,
} from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Boxes, Check, ChevronDown, ListOrdered, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { PaymentBadge, StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { useOrders } from '@/features/orders/api';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useDebouncedValue } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';

const QUICK = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'due_today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'ready', label: 'Ready' },
  { value: 'unpaid', label: 'Unpaid' },
] as const;

const DEFAULTS = {
  q: undefined as string | undefined,
  quick: undefined as string | undefined,
  status: undefined as string | undefined,
  paymentStatus: undefined as string | undefined,
  from: undefined as string | undefined,
  to: undefined as string | undefined,
  sort: 'createdAt',
  dir: 'desc',
  page: '1',
};

export function OrdersPage() {
  const f = useFormat();
  const { can, storeFilter, me } = useSession();
  const [state, setState] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(state.q ?? '');
  const debounced = useDebouncedValue(search, 250);

  useEffect(() => {
    if ((debounced || undefined) !== state.q) setState({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Number(state.page) || 1;
  const { data, isLoading, error, refetch, isFetching } = useOrders({
    q: state.q,
    quick: state.quick,
    status: state.status,
    paymentStatus: state.paymentStatus,
    from: state.from,
    to: state.to,
    storeId: storeFilter,
    sort: state.sort,
    dir: state.dir,
    page,
    pageSize: 25,
  });

  const selectedStatuses = useMemo(() => (state.status ? (state.status.split(',') as OrderStatus[]) : []), [state.status]);
  const toggleStatus = (s: OrderStatus) => {
    const next = selectedStatuses.includes(s) ? selectedStatuses.filter((x) => x !== s) : [...selectedStatuses, s];
    setState({ status: next.length ? next.join(',') : undefined });
  };
  const filtersActive = Boolean(state.q || state.quick || state.status || state.paymentStatus || state.from || state.to);
  const showStore = me.stores.length > 1 && !storeFilter;

  const columns = useMemo<ColumnDef<OrderListItem>[]>(
    () => [
      {
        id: 'orderNumber',
        header: 'Order #',
        meta: { sortKey: 'orderNumber' },
        cell: ({ row }) => (
          <Link href={`/orders/${row.original.id}`} className="font-mono text-[13px] font-medium hover:text-primary hover:underline">
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="max-w-[200px]">
            <p className="truncate font-medium">{customerDisplayName(row.original.customer)}</p>
            <p className="truncate text-xs text-muted-foreground md:hidden">{row.original.customer.phone}</p>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        meta: { hideOnMobile: true },
        cell: ({ row }) => <span className="tabular text-muted-foreground">{row.original.customer.phone}</span>,
      },
      {
        id: 'items',
        header: 'Items',
        meta: { align: 'right', hideOnMobile: true },
        cell: ({ row }) => <span className="tabular">{row.original.totalPieces}</span>,
      },
      {
        id: 'createdAt',
        header: 'Order date',
        meta: { sortKey: 'createdAt', hideOnMobile: true },
        cell: ({ row }) => <span className="text-muted-foreground">{f.dateTime(row.original.createdAt)}</span>,
      },
      {
        id: 'dueDate',
        header: 'Due',
        meta: { sortKey: 'dueDate' },
        cell: ({ row }) => {
          const o = row.original;
          const overdue = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK'].includes(o.status) && new Date(o.dueDate) < new Date();
          return <span className={cn(overdue && 'font-medium text-rose-600')}>{f.dateTime(o.dueDate)}</span>;
        },
      },
      { id: 'status', header: 'Status', meta: { sortKey: 'status' }, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'payment',
        header: 'Payment',
        meta: { hideOnMobile: true },
        cell: ({ row }) =>
          row.original.status === 'CANCELLED' ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <PaymentBadge status={row.original.paymentStatus} />
          ),
      },
      {
        id: 'grandTotal',
        header: 'Total',
        meta: { align: 'right', sortKey: 'grandTotal', hideOnMobile: true },
        cell: ({ row }) => <MoneyDisplay value={row.original.grandTotal} />,
      },
      {
        id: 'balanceDue',
        header: 'Balance',
        meta: { align: 'right', sortKey: 'balanceDue' },
        cell: ({ row }) =>
          row.original.status === 'CANCELLED' ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <MoneyDisplay value={row.original.balanceDue} emphasizeDue muteZero />
          ),
      },
      {
        id: 'rack',
        header: 'Rack',
        cell: ({ row }) =>
          row.original.rack ? (
            <Badge tone="teal">
              <Boxes />
              {row.original.rack.slotCode}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      ...(showStore
        ? [
            {
              id: 'store',
              header: 'Store',
              meta: { hideOnMobile: true },
              cell: ({ row }) => <span className="text-muted-foreground">{row.original.store.name}</span>,
            } satisfies ColumnDef<OrderListItem>,
          ]
        : []),
    ],
    [f, showStore],
  );

  return (
    <>
      <PageHeader
        title="Orders"
        description={
          data
            ? `${data.total.toLocaleString()} order${data.total === 1 ? '' : 's'}${filtersActive ? ' match your filters' : ''}`
            : 'All orders across your stores'
        }
        actions={
          can(Permission.ORDERS_CREATE) && (
            <Button asChild>
              <Link href="/orders/new">
                <Plus />
                New order
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Quick filters">
        {QUICK.map((q) => {
          const active = (state.quick ?? '') === q.value;
          return (
            <button
              key={q.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setState({ quick: q.value || undefined })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                active ? 'border-slate-900 bg-slate-900 text-white' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, phone, name or tag"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn(selectedStatuses.length && 'border-primary/50 text-primary')}>
              Status{selectedStatuses.length ? ` (${selectedStatuses.length})` : ''}
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {ORDER_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleStatus(s);
                }}
              >
                <span className="flex-1">{ORDER_STATUS_LABEL[s]}</span>
                {selectedStatuses.includes(s) && <Check className="!text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <NativeSelect
          className="w-auto"
          value={state.paymentStatus ?? ''}
          onChange={(e) => setState({ paymentStatus: e.target.value || undefined })}
          aria-label="Payment status"
        >
          <option value="">Any payment</option>
          {ORDER_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_PAYMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-auto"
            value={state.from ?? ''}
            onChange={(e) => setState({ from: e.target.value || undefined })}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="date"
            className="w-auto"
            value={state.to ?? ''}
            onChange={(e) => setState({ to: e.target.value || undefined })}
            aria-label="To date"
          />
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setState({ q: undefined, quick: undefined, status: undefined, paymentStatus: undefined, from: undefined, to: undefined });
            }}
          >
            <X />
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        sort={{ key: state.sort, dir: state.dir as 'asc' | 'desc' }}
        onSortChange={(s) => setState({ sort: s.key, dir: s.dir })}
        rowHref={(o) => `/orders/${o.id}`}
        getRowId={(o) => o.id}
        pagination={
          data
            ? { page, pageSize: data.pageSize, total: data.total, onPageChange: (p) => setState({ page: String(p) }, { resetPage: false }) }
            : undefined
        }
        empty={
          <EmptyState
            icon={ListOrdered}
            title={filtersActive ? 'No orders match these filters' : 'No orders yet'}
            description={
              filtersActive ? 'Try clearing a filter or searching by phone number.' : 'Orders you create at the counter will appear here.'
            }
          />
        }
      />
    </>
  );
}
