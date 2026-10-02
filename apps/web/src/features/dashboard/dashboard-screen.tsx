'use client';

import {
  customerDisplayName,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  Permission,
  type DashboardDto,
  type OrderListItem,
  type OrderStatus,
} from '@rinseops/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, ClipboardList, Banknote, PackageCheck, Plus, ReceiptText, Truck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { ORDER_STATUS_DOT, StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn, toQuery } from '@/lib/utils';
import { CollectionsChart } from './collections-chart';

const STATUS_FLOW: Array<keyof DashboardDto['statusCounts']> = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY', 'DELIVERED'];

export function DashboardScreen() {
  const { me, storeFilter, can } = useSession();
  const f = useFormat();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', storeFilter],
    queryFn: ({ signal }) => apiGet<DashboardDto>(`/dashboard${toQuery({ storeId: storeFilter })}`, signal),
    refetchInterval: 60_000,
  });

  if (error && !data) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  const m = data?.metrics;
  const greeting = (() => {
    const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: f.timeZone }).format(new Date()));
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me.user.name.split(' ')[0]}`}
        description={
          data
            ? `Here's ${storeFilter ? me.stores.find((s) => s.id === storeFilter)?.name : 'all stores'} today, ${f.calendarDate(data.date)}.`
            : ' '
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Today's revenue"
          value={m && f.money(m.revenueToday)}
          hint={m && `${m.paymentsToday} payments`}
          icon={Banknote}
          href="/payments?preset=today"
          loading={isLoading}
        />
        <StatCard
          label="Today's orders"
          value={m?.ordersToday}
          hint={m && `${f.money(m.salesToday)} booked`}
          icon={ReceiptText}
          href="/orders?quick=today"
          loading={isLoading}
        />
        <StatCard
          label="Pending"
          value={m?.pendingOrders}
          hint="Being processed"
          icon={ClipboardList}
          href="/orders?status=RECEIVED,PROCESSING,QUALITY_CHECK"
          loading={isLoading}
        />
        <StatCard
          label="Ready"
          value={m?.readyOrders}
          hint="Waiting for customers"
          icon={PackageCheck}
          tone="success"
          href="/orders?quick=ready"
          loading={isLoading}
        />
        <StatCard
          label="Unpaid amount"
          value={m && f.money(m.unpaidAmount)}
          hint={m && `${m.unpaidOrders} orders`}
          icon={Wallet}
          tone={m && Number(m.unpaidAmount) > 0 ? 'danger' : 'default'}
          href="/orders?quick=unpaid"
          loading={isLoading}
        />
        <StatCard
          label="Customers today"
          value={m?.customersToday}
          hint={m && `${m.newCustomersToday} new`}
          icon={Users}
          href="/customers"
          loading={isLoading}
        />
      </div>

      {/* Workflow strip */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Orders by status</CardTitle>
          {m && m.overdueOrders > 0 && (
            <Link href="/orders?quick=overdue" className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline">
              <AlertTriangle className="size-3.5" />
              {m.overdueOrders} overdue
            </Link>
          )}
        </CardHeader>
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-5 sm:divide-y-0">
          {STATUS_FLOW.map((s) => (
            <Link
              key={s}
              href={s === 'DELIVERED' ? '/orders?status=DELIVERED&quick=today' : `/orders?status=${s}`}
              className="group px-4 py-3 transition-colors hover:bg-slate-50"
            >
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', ORDER_STATUS_DOT[s as OrderStatus])} />
                {ORDER_STATUS_LABEL[s as OrderStatus]}
                {s === 'DELIVERED' && ' today'}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1.5 h-7 w-12" />
              ) : (
                <p className="tabular mt-0.5 text-2xl font-semibold group-hover:text-primary">{data?.statusCounts[s] ?? 0}</p>
              )}
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Due today</CardTitle>
            <Link href="/orders?quick=due_today" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <OrderMiniList orders={data?.dueToday} loading={isLoading} empty="Nothing due today." showRack />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Collections, last 7 days</CardTitle>
          </CardHeader>
          <div className="px-4 pt-2 pb-4">{data ? <CollectionsChart data={data.trend} /> : <Skeleton className="h-40" />}</div>
          {m && (m.pickupsToday > 0 || m.deliveriesToday > 0) && (
            <Link href="/tasks?scope=today" className="flex items-center gap-2 border-t px-4 py-2.5 text-sm hover:bg-slate-50">
              <Truck className="size-4 text-muted-foreground" />
              {m.pickupsToday} pickups · {m.deliveriesToday} deliveries scheduled today
            </Link>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="border-rose-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Overdue
              {m && m.overdueOrders > 0 && <Badge tone="red">{m.overdueOrders}</Badge>}
            </CardTitle>
            <Link href="/orders?quick=overdue" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <OrderMiniList orders={data?.overdue} loading={isLoading} empty="No overdue orders. Nice work." compact />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <Link href="/orders" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <OrderMiniList orders={data?.recentOrders} loading={isLoading} empty="No orders yet." compact />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <Link href="/payments" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          {isLoading ? (
            <ListSkeleton />
          ) : !data?.recentPayments.length ? (
            <EmptyState compact title="No payments yet" />
          ) : (
            <ul className="divide-y">
              {data.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{customerDisplayName(p.customer)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <Link href={`/orders/${p.order.id}`} className="font-mono hover:underline">
                        {p.order.orderNumber}
                      </Link>{' '}
                      · {PAYMENT_METHOD_LABEL[p.method]} · {f.relative(p.receivedAt)}
                    </p>
                  </div>
                  <MoneyDisplay value={p.amount} className="font-medium" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function OrderMiniList({
  orders,
  loading,
  empty,
  showRack,
  compact,
}: {
  orders?: OrderListItem[];
  loading: boolean;
  empty: string;
  showRack?: boolean;
  compact?: boolean;
}) {
  const f = useFormat();
  if (loading) return <ListSkeleton />;
  if (!orders?.length) return <EmptyState compact title={empty} />;
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-medium">{o.orderNumber}</span>
                {!compact && <StatusBadge status={o.status} />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {customerDisplayName(o.customer)} · {o.totalPieces} pcs · due {f.time(o.dueDate)}
                {compact && ` ${f.shortDate(o.dueDate)}`}
              </p>
            </div>
            {compact && <StatusBadge status={o.status} />}
            {showRack && o.rack && (
              <Badge tone="teal">
                <Boxes />
                {o.rack.slotCode}
              </Badge>
            )}
            {!compact && <MoneyDisplay value={o.balanceDue} emphasizeDue muteZero className="text-xs" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}
