'use client';

import {
  customerDisplayName,
  DELIVERY_MODE_LABEL,
  PAYMENT_METHOD_LABEL,
  Permission,
  type AddressDto,
  type OrderListItem,
  type PaymentDto,
} from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { LedgerStatusBadge, PaymentBadge, StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useCustomer, useCustomerOrders, useCustomerPayments, useRemoveAddress, useSetDefaultAddress } from '@/features/customers/api';
import { AddressDialog } from '@/features/customers/address-dialog';
import { CustomerFormDialog } from '@/features/customers/customer-form-dialog';

export function CustomerProfile({ id }: { id: string }) {
  const { can } = useSession();
  const f = useFormat();
  const { data: customer, isLoading, error, refetch } = useCustomer(id);
  const [editOpen, setEditOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  if (isLoading) return <ProfileSkeleton />;
  if (!customer) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  const canManage = can(Permission.CUSTOMERS_MANAGE);
  const ready = customer.openOrders.filter((o) => o.status === 'READY');

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Customers
      </Link>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-base font-semibold text-primary">
            {customer.firstName[0]}
            {customer.lastName?.[0] ?? ''}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{customerDisplayName(customer)}</h1>
              {customer.priceList && (
                <Badge tone="violet">
                  <Star />
                  {customer.priceList.name} pricing
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                <Phone className="size-3.5" />
                <span className="tabular">{customer.phone}</span>
              </a>
              {customer.alternatePhone && (
                <a href={`tel:${customer.alternatePhone}`} className="tabular hover:text-primary">
                  Alt: {customer.alternatePhone}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <Mail className="size-3.5" />
                  {customer.email}
                </a>
              )}
              <span>Customer since {f.date(customer.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
          )}
          {can(Permission.ORDERS_CREATE) && (
            <Button asChild>
              <Link href={`/orders/new?customerId=${customer.id}`}>
                <Plus />
                New order
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total orders" value={customer.stats.totalOrders.toLocaleString()} icon={ShoppingBag} />
        <StatCard label="Total spent" value={f.money(customer.stats.totalSpent)} icon={ReceiptText} />
        <StatCard
          label="Outstanding"
          value={f.money(customer.stats.outstanding)}
          icon={Wallet}
          tone={Number(customer.stats.outstanding) > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Last order"
          value={customer.stats.lastOrderAt ? f.shortDate(customer.stats.lastOrderAt) : '—'}
          hint={customer.stats.lastOrderAt ? f.relative(customer.stats.lastOrderAt) : 'No orders yet'}
          icon={CalendarClock}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Open orders
                {ready.length > 0 && (
                  <Badge tone="green" className="ml-2 align-middle">
                    {ready.length} ready for collection
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            {customer.openOrders.length === 0 ? (
              <EmptyState compact icon={ShoppingBag} title="No open orders" description="Everything has been collected." />
            ) : (
              <ul className="divide-y">
                {customer.openOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">{o.orderNumber}</span>
                          <StatusBadge status={o.status} />
                          <PaymentBadge status={o.paymentStatus} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {o.totalPieces} pcs · due {f.dateTime(o.dueDate)}
                        </p>
                      </div>
                      {o.rack ? (
                        <Badge tone="teal" className="px-2 py-1 text-sm">
                          <Boxes className="!size-4" />
                          {o.rack.rackName} → {o.rack.slot}
                        </Badge>
                      ) : (
                        o.status === 'READY' && <span className="text-xs text-amber-700">Not on a rack</span>
                      )}
                      <div className="text-right">
                        <MoneyDisplay value={o.balanceDue} emphasizeDue muteZero className="text-sm" />
                        <p className="text-xs text-muted-foreground">of {f.money(o.grandTotal)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">Order history</TabsTrigger>
              {can(Permission.PAYMENTS_VIEW) && <TabsTrigger value="payments">Payment history</TabsTrigger>}
            </TabsList>
            <TabsContent value="orders" className="pt-3">
              <OrderHistory customerId={customer.id} />
            </TabsContent>
            {can(Permission.PAYMENTS_VIEW) && (
              <TabsContent value="payments" className="pt-3">
                <PaymentHistory customerId={customer.id} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
              {canManage && (
                <Button variant="ghost" size="xs" className="text-primary" onClick={() => setAddressOpen(true)}>
                  <Plus />
                  Add
                </Button>
              )}
            </CardHeader>
            {customer.addresses.length === 0 ? (
              <EmptyState compact icon={MapPin} title="No saved addresses" description="Add one for pickups and home delivery." />
            ) : (
              <ul className="divide-y">
                {customer.addresses.map((a) => (
                  <AddressRow key={a.id} customerId={customer.id} address={a} canManage={canManage} />
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              {canManage && (
                <Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {customer.notes ? (
                <p className="text-sm whitespace-pre-line">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes. Add preferences like starch level or fold style.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <AddressDialog customerId={customer.id} open={addressOpen} onOpenChange={setAddressOpen} />
    </>
  );
}

function AddressRow({ customerId, address, canManage }: { customerId: string; address: AddressDto; canManage: boolean }) {
  const remove = useRemoveAddress(customerId);
  const setDefault = useSetDefaultAddress(customerId);
  const [confirm, setConfirm] = useState(false);
  const lines = [
    address.addressLine1,
    address.addressLine2,
    address.landmark && `Near ${address.landmark}`,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{address.label}</span>
          {address.isDefault && <Badge tone="teal">Default</Badge>}
        </div>
        {lines.map((l, i) => (
          <p key={i} className="text-muted-foreground">
            {l}
          </p>
        ))}
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Address actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {!address.isDefault && (
              <DropdownMenuItem
                onSelect={() =>
                  setDefault.mutate(address.id, {
                    onSuccess: () => toast.success('Default address updated'),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                <Star />
                Make default
              </DropdownMenuItem>
            )}
            <DropdownMenuItem destructive onSelect={() => setConfirm(true)}>
              <Trash2 />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this address?"
        description="Past orders keep their delivery details. This can't be undone."
        confirmLabel="Remove address"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(address.id, {
            onSuccess: () => {
              setConfirm(false);
              toast.success('Address removed');
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </li>
  );
}

function OrderHistory({ customerId }: { customerId: string }) {
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useCustomerOrders(customerId, page);
  const columns: ColumnDef<OrderListItem>[] = [
    {
      id: 'number',
      header: 'Order #',
      cell: ({ row }) => <span className="font-mono text-[13px] font-medium">{row.original.orderNumber}</span>,
    },
    { id: 'date', header: 'Date', cell: ({ row }) => f.date(row.original.createdAt) },
    { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'pieces',
      header: 'Pieces',
      meta: { align: 'right', hideOnMobile: true },
      cell: ({ row }) => <span className="tabular">{row.original.totalPieces}</span>,
    },
    {
      id: 'mode',
      header: 'Mode',
      meta: { hideOnMobile: true },
      cell: ({ row }) => <span className="text-muted-foreground">{DELIVERY_MODE_LABEL[row.original.deliveryMode]}</span>,
    },
    { id: 'total', header: 'Total', meta: { align: 'right' }, cell: ({ row }) => <MoneyDisplay value={row.original.grandTotal} /> },
    {
      id: 'balance',
      header: 'Balance',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.status === 'CANCELLED' ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <MoneyDisplay value={row.original.balanceDue} emphasizeDue muteZero />
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data?.items}
      loading={isLoading || isFetching}
      error={error}
      onRetry={() => void refetch()}
      rowHref={(o) => `/orders/${o.id}`}
      getRowId={(o) => o.id}
      skeletonRows={5}
      pagination={data && { page, pageSize: data.pageSize, total: data.total, onPageChange: setPage }}
      empty={<EmptyState compact icon={ShoppingBag} title="No orders yet" />}
    />
  );
}

function PaymentHistory({ customerId }: { customerId: string }) {
  const f = useFormat();
  const { data, isLoading, error, refetch } = useCustomerPayments(customerId);
  type Row = PaymentDto & { order: { id: string; orderNumber: string } };
  const columns: ColumnDef<Row>[] = [
    { id: 'date', header: 'Date', cell: ({ row }) => f.dateTime(row.original.receivedAt) },
    {
      id: 'order',
      header: 'Order #',
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.order.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">
          {row.original.order.orderNumber}
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
    { id: 'status', header: 'Status', cell: ({ row }) => <LedgerStatusBadge status={row.original.status} /> },
    {
      id: 'amount',
      header: 'Amount',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <MoneyDisplay
          value={row.original.amount}
          className={row.original.status === 'REFUNDED' ? 'text-muted-foreground line-through' : ''}
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      error={error}
      onRetry={() => void refetch()}
      getRowId={(p) => p.id}
      skeletonRows={4}
      empty={<EmptyState compact icon={Wallet} title="No payments yet" />}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
