'use client';

import { customerDisplayName, Permission, type CustomerListItem } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useDebouncedValue } from '@/lib/use-debounce';
import { useCustomers } from '@/features/customers/api';
import { CustomerFormDialog } from '@/features/customers/customer-form-dialog';

const SORTS = [
  ['recent', 'Recent activity'],
  ['name', 'Name'],
  ['orders', 'Most orders'],
  ['spent', 'Top spenders'],
  ['balance', 'Highest balance'],
] as const;

export function CustomersView() {
  const router = useRouter();
  const { can } = useSession();
  const f = useFormat();
  const [state, setState] = useUrlState({ q: undefined as string | undefined, sort: 'recent', page: '1' });
  const [search, setSearch] = useState(state.q ?? '');
  const debounced = useDebouncedValue(search.trim(), 250);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if ((state.q ?? '') !== debounced) setState({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Stable while the dialog is open: the dialog resets its form when this changes.
  const createInitial = useMemo(
    () => (createOpen && /^[+\d\s\-()]{6,}$/.test(search.trim()) ? { phone: search.trim() } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createOpen],
  );

  const page = Math.max(1, Number(state.page) || 1);
  const { data, isLoading, error, refetch, isFetching } = useCustomers({
    q: state.q || undefined,
    sort: state.sort,
    page,
    pageSize: 25,
  });

  const columns: ColumnDef<CustomerListItem>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{customerDisplayName(row.original)}</p>
          {row.original.email && <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>}
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="tabular">{row.original.phone}</span>,
    },
    {
      id: 'orders',
      header: 'Orders',
      meta: { align: 'right', hideOnMobile: true },
      cell: ({ row }) => <span className="tabular">{row.original.orderCount}</span>,
    },
    {
      id: 'spent',
      header: 'Total spent',
      meta: { align: 'right', hideOnMobile: true },
      cell: ({ row }) => <MoneyDisplay value={row.original.totalSpent} muteZero />,
    },
    {
      id: 'balance',
      header: 'Balance',
      meta: { align: 'right' },
      cell: ({ row }) => <MoneyDisplay value={row.original.balance} emphasizeDue muteZero />,
    },
    {
      id: 'last',
      header: 'Last order',
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.lastOrderAt ? f.date(row.original.lastOrderAt) : 'No orders yet'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description={data ? `${data.total.toLocaleString()} customers` : 'Everyone who has ordered or booked a pickup'}
        actions={
          can(Permission.CUSTOMERS_MANAGE) && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New customer
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone or name…"
            className="pl-9"
            inputMode="search"
            aria-label="Search customers"
          />
        </div>
        <NativeSelect aria-label="Sort" className="sm:w-48" value={state.sort} onChange={(e) => setState({ sort: e.target.value })}>
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>
      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(c) => `/customers/${c.id}`}
        getRowId={(c) => c.id}
        pagination={data && { page, pageSize: data.pageSize, total: data.total, onPageChange: (p) => setState({ page: String(p) }) }}
        empty={
          <EmptyState
            icon={Users}
            title={state.q ? 'No customers match your search' : 'No customers yet'}
            description={
              state.q ? 'Try a different phone number or name.' : 'Customers are added when you create an order or someone books a pickup.'
            }
            action={
              can(Permission.CUSTOMERS_MANAGE) && !state.q ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus />
                  New customer
                </Button>
              ) : undefined
            }
          />
        }
      />
      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={createInitial}
        onSaved={(c) => router.push(`/customers/${c.id}`)}
        onDuplicate={(id) => router.push(`/customers/${id}`)}
      />
    </>
  );
}
