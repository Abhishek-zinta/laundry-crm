'use client';

import {
  customerDisplayName,
  DATE_PRESETS,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  Permission,
  resolvePresetKeys,
  sumMoney,
  type DatePreset,
  type PaymentListItem,
  type PaymentMethod,
} from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Banknote, CreditCard, Landmark, Search, Smartphone, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { DataTable } from '@/components/shared/data-table';
import { DateRangeFilter } from '@/components/shared/date-range-filter';
import { EmptyState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { LedgerStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useDebouncedValue } from '@/lib/use-debounce';
import { usePayments, useRefundPayment } from '@/features/payments/api';

const PAGE_SIZE = 25;

export function PaymentsView() {
  const { can, storeFilter, me } = useSession();
  const f = useFormat();
  const tz = me.tenant.settings.timezone;
  const [state, setState] = useUrlState({
    preset: 'today',
    from: undefined as string | undefined,
    to: undefined as string | undefined,
    method: undefined as string | undefined,
    q: undefined as string | undefined,
    page: '1',
  });
  const [search, setSearch] = useState(state.q ?? '');
  const debounced = useDebouncedValue(search.trim(), 250);
  useEffect(() => {
    if ((state.q ?? '') !== debounced) setState({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const preset = ((DATE_PRESETS as readonly string[]).includes(state.preset) ? state.preset : 'today') as DatePreset;
  const range = useMemo(() => resolvePresetKeys(preset, tz, { from: state.from, to: state.to }), [preset, tz, state.from, state.to]);
  const page = Math.max(1, Number(state.page) || 1);
  const method = (PAYMENT_METHODS as readonly string[]).includes(state.method ?? '') ? (state.method as PaymentMethod) : undefined;

  const { data, isLoading, isFetching, error, refetch } = usePayments({
    from: range.from,
    to: range.to,
    method,
    storeId: storeFilter,
    q: state.q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const [refunding, setRefunding] = useState<PaymentListItem | null>(null);
  const refund = useRefundPayment();
  const canRefund = can(Permission.PAYMENTS_REFUND);

  const by = (m: PaymentMethod) => data?.summary.byMethod.find((s) => s.method === m);
  const other = sumMoney([by('BANK_TRANSFER')?.amount, by('OTHER')?.amount]);
  const summaryLoading = isLoading && !data;

  const columns: ColumnDef<PaymentListItem>[] = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.receivedAt)}</span>,
    },
    {
      id: 'order',
      header: 'Order #',
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.order.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">
          {row.original.order.orderNumber}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.customer.id}`} className="hover:underline">
          {customerDisplayName(row.original.customer)}
        </Link>
      ),
    },
    { id: 'method', header: 'Method', cell: ({ row }) => PAYMENT_METHOD_LABEL[row.original.method] },
    {
      id: 'ref',
      header: 'Reference',
      meta: { hideOnMobile: true },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.reference ?? '—'}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <MoneyDisplay
          value={row.original.amount}
          className={row.original.status === 'REFUNDED' ? 'text-muted-foreground line-through' : 'font-medium'}
        />
      ),
    },
    { id: 'status', header: 'Status', cell: ({ row }) => <LedgerStatusBadge status={row.original.status} /> },
    {
      id: 'by',
      header: 'Received by',
      meta: { hideOnMobile: true },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.receivedBy?.name ?? '—'}</span>,
    },
    {
      id: 'store',
      header: 'Store',
      meta: { hideOnMobile: true },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.store.name}</span>,
    },
    ...(canRefund
      ? [
          {
            id: 'actions',
            header: '',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: PaymentListItem } }) =>
              row.original.status === 'COMPLETED' ? (
                <Button variant="ghost" size="xs" onClick={() => setRefunding(row.original)}>
                  <Undo2 />
                  Refund
                </Button>
              ) : null,
          } satisfies ColumnDef<PaymentListItem>,
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded against orders, with collections by method." />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Cash"
          value={f.money(by('CASH')?.amount)}
          hint={`${by('CASH')?.count ?? 0} payments`}
          icon={Banknote}
          loading={summaryLoading}
        />
        <StatCard
          label="Card"
          value={f.money(by('CARD')?.amount)}
          hint={`${by('CARD')?.count ?? 0} payments`}
          icon={CreditCard}
          loading={summaryLoading}
        />
        <StatCard
          label="UPI"
          value={f.money(by('UPI')?.amount)}
          hint={`${by('UPI')?.count ?? 0} payments`}
          icon={Smartphone}
          loading={summaryLoading}
        />
        <StatCard
          label="Bank transfer & other"
          value={f.money(other)}
          hint={`${(by('BANK_TRANSFER')?.count ?? 0) + (by('OTHER')?.count ?? 0)} payments`}
          icon={Landmark}
          loading={summaryLoading}
        />
        <StatCard
          label="Total collected"
          value={f.money(data?.summary.totalCollected)}
          icon={Wallet}
          tone="success"
          loading={summaryLoading}
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <DateRangeFilter
          value={{ preset, from: state.from ?? range.from, to: state.to ?? range.to }}
          onChange={(v) =>
            setState(
              v.preset === 'custom' ? { preset: v.preset, from: v.from, to: v.to } : { preset: v.preset, from: undefined, to: undefined },
            )
          }
        />
        <NativeSelect
          aria-label="Payment method"
          className="lg:w-44"
          value={method ?? ''}
          onChange={(e) => setState({ method: e.target.value || undefined })}
        >
          <option value="">All methods</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </NativeSelect>
        <div className="relative lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, phone, name, reference…"
            className="pl-9"
            aria-label="Search payments"
          />
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto">
          {f.calendarDate(range.from)}
          {range.to !== range.from && ` – ${f.calendarDate(range.to)}`}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading || isFetching}
        error={error}
        onRetry={() => void refetch()}
        getRowId={(p) => p.id}
        pagination={data && { page, pageSize: data.pageSize, total: data.total, onPageChange: (p) => setState({ page: String(p) }) }}
        empty={
          <EmptyState icon={Wallet} title="No payments in this period" description="Try a wider date range or clear the method filter." />
        }
      />

      <ConfirmationDialog
        open={Boolean(refunding)}
        onOpenChange={(o) => !o && setRefunding(null)}
        title="Refund this payment?"
        description={
          refunding && (
            <>
              {f.money(refunding.amount)} {PAYMENT_METHOD_LABEL[refunding.method]} on order {refunding.order.orderNumber}. The order balance
              will increase by this amount. Return the money to the customer separately.
            </>
          )
        }
        confirmLabel="Refund payment"
        destructive
        loading={refund.isPending}
        reason={{ label: 'Reason', placeholder: 'e.g. Duplicate charge, customer complaint', required: true }}
        onConfirm={(reason) => {
          if (!refunding || !reason) return;
          refund.mutate(
            { id: refunding.id, reason },
            {
              onSuccess: () => {
                toast.success('Payment refunded');
                setRefunding(null);
              },
              onError: (e) => toast.error(errorMessage(e, "We couldn't refund this payment. Please try again.")),
            },
          );
        }}
      />
    </>
  );
}
