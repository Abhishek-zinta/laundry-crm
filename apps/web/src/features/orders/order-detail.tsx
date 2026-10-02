'use client';

import {
  customerDisplayName,
  DELIVERY_MODE_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STAGES,
  PAYMENT_METHOD_LABEL,
  Permission,
  RackRemovalReason,
  stageIndex,
  TASK_TYPE_LABEL,
  toDecimal,
  UNIT_TYPE_SHORT,
  type GarmentDto,
  type OrderDetail,
  type OrderStatus,
} from '@rinseops/shared';
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  Store,
  Tags,
  Truck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { GarmentIcon } from '@/components/shared/garment-icon';
import { MoneyDisplay } from '@/components/shared/money';
import { OrderTimeline } from '@/components/shared/order-timeline';
import { LedgerStatusBadge, PaymentBadge, StatusBadge, TaskStatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { GarmentEditDialog } from '../garments/garment-edit-dialog';
import { IssueBadges } from '../garments/issue-badges';
import { CreateTaskDialog } from '../tasks/create-task-dialog';
import { AddPaymentDialog } from './add-payment-dialog';
import { useCancelOrder, useChangeOrderStatus, useOrder, useRefundPayment, useRemoveFromRack } from './api';
import { AssignRackDialog } from './assign-rack-dialog';
import { DeliverDialog } from './deliver-dialog';
import { EditDetailsDialog } from './edit-details-dialog';
import { REWORK_LABEL, STATUS_ACTION_LABEL } from './status-labels';

const TABS = ['items', 'garments', 'payments', 'timeline', 'delivery'] as const;
type Tab = (typeof TABS)[number];

type DialogName = 'payment' | 'rack' | 'deliver' | 'edit' | 'cancel' | 'unrack' | 'task' | null;

export function OrderDetailView({ id }: { id: string }) {
  const { data: order, isLoading, error, refetch } = useOrder(id);
  if (isLoading) return <OrderSkeleton />;
  if (!order) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  return <OrderDetailContent order={order} />;
}

function OrderDetailContent({ order }: { order: OrderDetail }) {
  const f = useFormat();
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useSession();
  const tabParam = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam && TABS.includes(tabParam) ? tabParam : 'items');
  const [dialog, setDialog] = useState<DialogName>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [editGarment, setEditGarment] = useState<GarmentDto | null>(null);
  const [statusTarget, setStatusTarget] = useState<OrderStatus | null>(null);

  const changeStatus = useChangeOrderStatus(order.id);
  const cancel = useCancelOrder(order.id);
  const refund = useRefundPayment();
  const unrack = useRemoveFromRack(order.id);

  const status = order.status;
  const closed = status === 'DELIVERED' || status === 'CANCELLED';
  const owing = toDecimal(order.balanceDue).greaterThan(0);
  const allowed = order.workflow.allowedTransitions;
  const next = order.workflow.nextStatus && allowed.includes(order.workflow.nextStatus) ? order.workflow.nextStatus : null;
  const overdue = !closed && status !== 'READY' && new Date(order.dueDate) < new Date();
  const lineById = new Map(order.lines.map((l) => [l.id, l]));

  const runStatus = async (to: OrderStatus, opts: { note?: string; allowOutstanding?: boolean } = {}) => {
    try {
      await changeStatus.mutateAsync({ status: to, ...opts });
      toast.success(`${order.orderNumber} → ${ORDER_STATUS_LABEL[to]}`);
      setDialog(null);
      setStatusTarget(null);
      if (to === 'READY' && can(Permission.RACKS_ASSIGN)) setDialog('rack');
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't change the status."));
    }
  };

  const onPrimary = () => {
    if (!next) return;
    if (next === 'DELIVERED') setDialog('deliver');
    else void runStatus(next);
  };

  const tabChange = (t: string) => {
    setTab(t as Tab);
    const sp = new URLSearchParams(params.toString());
    if (t === 'items') sp.delete('tab');
    else sp.set('tab', t);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const rework = allowed.filter((s) => s !== 'CANCELLED' && stageIndex(s) < stageIndex(status));

  return (
    <div className="grid gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{order.orderNumber}</h1>
            <StatusBadge status={status} />
            {status !== 'CANCELLED' && <PaymentBadge status={order.paymentStatus} />}
            {overdue && <Badge tone="red">Overdue</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Link href={`/customers/${order.customer.id}`} className="font-medium text-foreground hover:underline">
              {customerDisplayName(order.customer)}
            </Link>
            <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Phone className="size-3.5" />
              {order.customer.phone}
            </a>
            <span className="inline-flex items-center gap-1">
              <Store className="size-3.5" />
              {order.store.name}
            </span>
            <span>Created {f.dateTime(order.createdAt)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {next && can(next === 'DELIVERED' ? Permission.ORDERS_DELIVER : Permission.ORDERS_PROCESS) && (
            <Button onClick={onPrimary} loading={changeStatus.isPending && statusTarget === null}>
              <Check />
              {STATUS_ACTION_LABEL[next]}
            </Button>
          )}
          {!closed && owing && can(Permission.PAYMENTS_CREATE) && (
            <Button variant={next === 'DELIVERED' ? 'outline' : 'soft'} onClick={() => setDialog('payment')}>
              <CreditCard />
              Add payment
            </Button>
          )}
          {status === 'READY' && can(Permission.RACKS_ASSIGN) && (
            <Button variant="outline" onClick={() => setDialog('rack')}>
              <Boxes />
              {order.rack ? 'Move rack' : 'Assign rack'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Printer />
                Print
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <a href={`/print/receipt/${order.id}?format=thermal`} target="_blank" rel="noreferrer">
                  <Printer />
                  Receipt (80mm)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/print/receipt/${order.id}?format=a4`} target="_blank" rel="noreferrer">
                  <Printer />
                  Invoice (A4)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/print/tags/${order.id}`} target="_blank" rel="noreferrer">
                  <Tags />
                  Garment tags
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {!closed && can(Permission.ORDERS_EDIT) && (
                <>
                  {order.workflow.canEditItems && (
                    <DropdownMenuItem asChild>
                      <Link href={`/orders/${order.id}/edit`}>
                        <Pencil />
                        Edit items
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setDialog('edit')}>
                    <CalendarClock />
                    Edit due date, discount & notes
                  </DropdownMenuItem>
                </>
              )}
              {allowed.filter((s) => s !== 'CANCELLED').length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Change status</DropdownMenuLabel>
                  {allowed
                    .filter((s) => s !== 'CANCELLED')
                    .map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() => {
                          if (s === 'DELIVERED') setDialog('deliver');
                          else setStatusTarget(s);
                        }}
                      >
                        {rework.includes(s) ? <RotateCcw /> : <Check />}
                        {rework.includes(s) ? `${REWORK_LABEL} (${ORDER_STATUS_LABEL[s]})` : STATUS_ACTION_LABEL[s]}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
              {order.rack && can(Permission.RACKS_ASSIGN) && !closed && (
                <DropdownMenuItem onSelect={() => setDialog('unrack')}>
                  <Boxes />
                  Remove from rack
                </DropdownMenuItem>
              )}
              {!closed && can(Permission.TASKS_MANAGE) && (
                <DropdownMenuItem onSelect={() => setDialog('task')}>
                  <Truck />
                  Schedule delivery
                </DropdownMenuItem>
              )}
              {allowed.includes('CANCELLED') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setDialog('cancel')}>
                    <XCircle />
                    Cancel order
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {status === 'CANCELLED' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Cancelled {f.dateTime(order.cancelledAt)}
          {order.cancelReason && <> — “{order.cancelReason}”</>}
        </div>
      )}

      <StageProgress status={status} />

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Fact label="Total" value={<MoneyDisplay value={order.grandTotal} />} />
        <Fact label="Paid" value={<MoneyDisplay value={order.paidAmount} className="text-emerald-700" />} />
        <Fact
          label="Outstanding"
          value={status === 'CANCELLED' ? '—' : <MoneyDisplay value={order.balanceDue} emphasizeDue />}
          highlight={owing && status !== 'CANCELLED' ? 'red' : undefined}
        />
        <Fact label="Due" value={f.dateTime(order.dueDate)} highlight={overdue ? 'red' : undefined} />
        <Fact
          label="Rack location"
          value={
            order.rack ? (
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="size-4" />
                {order.rack.rackName} → {order.rack.slotCode}
              </span>
            ) : status === 'READY' ? (
              <span className="text-amber-700">Not racked</span>
            ) : (
              '—'
            )
          }
          highlight={order.rack ? 'teal' : undefined}
        />
        <Fact label="Collection" value={DELIVERY_MODE_LABEL[order.deliveryMode]} sub={order.deliveryAddress?.addressLine1} />
      </div>

      {(order.notes || order.customer.notes) && (
        <div className="grid gap-2 md:grid-cols-2">
          {order.notes && <Note label="Order notes" text={order.notes} />}
          {order.customer.notes && <Note label="Customer notes" text={order.customer.notes} />}
        </div>
      )}

      <Card>
        <Tabs value={tab} onValueChange={tabChange}>
          <TabsList className="px-2">
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="garments">
              Garments <span className="text-xs text-muted-foreground">{order.garments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="payments">
              Payments <span className="text-xs text-muted-foreground">{order.payments.length}</span>
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="delivery">Pickup / Delivery</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-3">
                        <GarmentIcon name={l.itemName} icon={l.icon} className="size-9" />
                        <div>
                          <p className="font-medium">{l.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.categoryName}
                            {l.modifiers.map((m) => ` · ${m.name}`)}
                            {l.notes && ` · ${l.notes}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {Number(l.quantity)} {UNIT_TYPE_SHORT[l.unitType]}
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={l.unitPrice} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <MoneyDisplay value={l.lineTotal} />
                      {Number(l.modifiersAmount) > 0 && (
                        <p className="text-xs font-normal text-muted-foreground">
                          incl. add-ons <MoneyDisplay value={l.modifiersAmount} />
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto grid max-w-xs gap-1.5 border-t px-4 py-3 text-sm">
              <Row label="Subtotal" value={order.subtotal} />
              {Number(order.discountAmount) > 0 && (
                <Row
                  label={`Discount${order.discountType === 'PERCENT' ? ` (${Number(order.discountValue)}%)` : ''}`}
                  value={order.discountAmount}
                  negative
                />
              )}
              {Number(order.taxRate) > 0 && (
                <Row
                  label={`${order.taxName ?? 'Tax'} ${Number(order.taxRate)}%${order.taxInclusive ? ' (incl.)' : ''}`}
                  value={order.taxAmount}
                />
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total</span>
                <MoneyDisplay value={order.grandTotal} />
              </div>
              <Row label="Paid" value={order.paidAmount} />
              <div className="flex justify-between font-semibold">
                <span>Balance</span>
                <MoneyDisplay value={order.balanceDue} emphasizeDue />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="garments">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm">
              <p className="text-muted-foreground">
                {order.garments.length} tag{order.garments.length === 1 ? '' : 's'} ·{' '}
                {order.garments.filter((g) => g.issues.length || g.damageNotes).length} with recorded issues
              </p>
              <Button asChild size="sm" variant="outline">
                <a href={`/print/tags/${order.id}`} target="_blank" rel="noreferrer">
                  <Tags />
                  Print tags
                </a>
              </Button>
            </div>
            <ul className="divide-y">
              {order.garments.map((g) => {
                const line = lineById.get(g.orderLineId);
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                    <GarmentIcon name={line?.itemName ?? ''} icon={line?.icon} className="size-8" />
                    <span className="font-mono text-[13px] font-semibold">{g.tagCode}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {line?.itemName}
                        <span className="text-muted-foreground"> · {line?.categoryName}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[g.color, g.brand, g.fabric].filter(Boolean).join(' · ') || 'No details recorded'}
                        {g.specialInstructions && ` · ${g.specialInstructions}`}
                      </p>
                      {(g.issues.length > 0 || g.damageNotes) && (
                        <div className="mt-1">
                          <IssueBadges issues={g.issues} />
                          {g.damageNotes && <span className="text-xs text-amber-800">{g.damageNotes}</span>}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={g.status} />
                    {can(Permission.GARMENTS_UPDATE) && !closed && (
                      <Button variant="ghost" size="sm" onClick={() => setEditGarment(g)}>
                        <Pencil />
                        Details
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </TabsContent>

          <TabsContent value="payments">
            {order.payments.length === 0 ? (
              <EmptyState
                compact
                icon={CreditCard}
                title="No payments yet"
                action={
                  owing && !closed && can(Permission.PAYMENTS_CREATE) ? (
                    <Button size="sm" onClick={() => setDialog('payment')}>
                      Add payment
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden md:table-cell">Reference</TableHead>
                    <TableHead className="hidden md:table-cell">Received by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{f.dateTime(p.receivedAt)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{p.reference ?? '—'}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{p.receivedBy?.name ?? '—'}</TableCell>
                      <TableCell>
                        <LedgerStatusBadge status={p.status} />
                        {p.status === 'REFUNDED' && p.refundReason && (
                          <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground" title={p.refundReason}>
                            {p.refundReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={cn('text-right font-medium', p.status === 'REFUNDED' && 'text-muted-foreground line-through')}>
                        <MoneyDisplay value={p.amount} />
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === 'COMPLETED' && can(Permission.PAYMENTS_REFUND) && (
                          <Button variant="ghost" size="xs" onClick={() => setRefundId(p.id)}>
                            Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <div className="grid gap-6 p-4 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status history</p>
                <OrderTimeline history={order.statusHistory} />
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rack history</p>
                {order.rackHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not placed on a rack yet.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {order.rackHistory.map((r) => (
                      <li key={r.id} className="rounded-md border px-3 py-2">
                        <p className="font-medium">
                          {r.rackName} → {r.slotCode}
                          {!r.removedAt && (
                            <Badge tone="teal" className="ml-2">
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Placed {f.dateTime(r.assignedAt)}
                          {r.assignedBy && ` by ${r.assignedBy.name}`}
                        </p>
                        {r.removedAt && (
                          <p className="text-xs text-muted-foreground">
                            {r.removalReason === RackRemovalReason.DELIVERED
                              ? 'Collected'
                              : r.removalReason === RackRemovalReason.MOVED
                                ? 'Moved'
                                : 'Removed'}{' '}
                            {f.dateTime(r.removedAt)}
                            {r.removedBy && ` by ${r.removedBy.name}`}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="delivery">
            <div className="p-4">
              <p className="text-sm">
                <span className="text-muted-foreground">Collection:</span>{' '}
                <span className="font-medium">{DELIVERY_MODE_LABEL[order.deliveryMode]}</span>
                {order.deliveryAddress && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {order.deliveryAddress.addressLine1}
                    {order.deliveryAddress.city ? `, ${order.deliveryAddress.city}` : ''}
                  </span>
                )}
              </p>
              {order.tasks.length === 0 ? (
                <EmptyState
                  compact
                  icon={Truck}
                  title="No pickup or delivery tasks"
                  description={order.deliveryMode === 'HOME_DELIVERY' ? 'Schedule a delivery when the order is ready.' : undefined}
                  action={
                    !closed && can(Permission.TASKS_MANAGE) ? (
                      <Button size="sm" variant="outline" onClick={() => setDialog('task')}>
                        Schedule delivery
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="mt-3 grid gap-2">
                  {order.tasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
                      <Badge tone={t.type === 'PICKUP' ? 'violet' : 'blue'}>{TASK_TYPE_LABEL[t.type]}</Badge>
                      <span>
                        {f.calendarDate(t.scheduledDate)} · {t.timeSlot}
                      </span>
                      <span className="text-muted-foreground">{t.assignedDriver ? t.assignedDriver.name : 'Unassigned'}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.address}</span>
                      <TaskStatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Dialogs */}
      <AddPaymentDialog order={order} open={dialog === 'payment'} onOpenChange={(o) => setDialog(o ? 'payment' : null)} />
      <AssignRackDialog order={order} open={dialog === 'rack'} onOpenChange={(o) => setDialog(o ? 'rack' : null)} />
      <DeliverDialog
        order={order}
        open={dialog === 'deliver'}
        onOpenChange={(o) => setDialog(o ? 'deliver' : null)}
        onCollectPayment={() => setDialog('payment')}
        onDeliver={(allowOutstanding) => void runStatus('DELIVERED', { allowOutstanding })}
        loading={changeStatus.isPending}
      />
      <EditDetailsDialog order={order} open={dialog === 'edit'} onOpenChange={(o) => setDialog(o ? 'edit' : null)} />
      <ConfirmationDialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={statusTarget ? `${rework.includes(statusTarget) ? REWORK_LABEL : STATUS_ACTION_LABEL[statusTarget]}?` : ''}
        description={
          statusTarget
            ? `${order.orderNumber} will move from ${ORDER_STATUS_LABEL[status]} to ${ORDER_STATUS_LABEL[statusTarget]}.`
            : undefined
        }
        reason={
          statusTarget && rework.includes(statusTarget) ? { label: 'What needs rework?', required: true } : { label: 'Note (optional)' }
        }
        confirmLabel="Change status"
        loading={changeStatus.isPending}
        onConfirm={(note) => {
          if (statusTarget) void runStatus(statusTarget, { note: note || undefined });
        }}
      />
      <ConfirmationDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => setDialog(o ? 'cancel' : null)}
        title={`Cancel ${order.orderNumber}?`}
        description={
          Number(order.paidAmount) > 0
            ? 'This order has payments. Refund them first — cancellation is blocked while money is held.'
            : 'The order and its garments will be marked cancelled. This cannot be undone.'
        }
        destructive
        confirmLabel="Cancel order"
        reason={{ label: 'Reason', required: true, placeholder: 'e.g. Customer changed their mind' }}
        loading={cancel.isPending}
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync(reason ?? '');
            toast.success(`${order.orderNumber} cancelled`);
            setDialog(null);
          } catch (err) {
            toast.error(errorMessage(err, "We couldn't cancel this order."));
          }
        }}
      />
      <ConfirmationDialog
        open={dialog === 'unrack'}
        onOpenChange={(o) => setDialog(o ? 'unrack' : null)}
        title="Remove from rack?"
        description={order.rack ? `${order.rack.rackName} → ${order.rack.slotCode} will become available.` : undefined}
        confirmLabel="Remove"
        loading={unrack.isPending}
        onConfirm={async () => {
          try {
            await unrack.mutateAsync();
            toast.success('Removed from rack');
            setDialog(null);
          } catch (err) {
            toast.error(errorMessage(err, "We couldn't update the rack."));
          }
        }}
      />
      <ConfirmationDialog
        open={refundId !== null}
        onOpenChange={(o) => !o && setRefundId(null)}
        title="Refund this payment?"
        description="The payment stays in the ledger marked as refunded, and the order balance increases."
        destructive
        confirmLabel="Refund"
        reason={{ label: 'Reason', required: true }}
        loading={refund.isPending}
        onConfirm={async (reason) => {
          try {
            await refund.mutateAsync({ paymentId: refundId!, reason: reason ?? '' });
            toast.success('Payment refunded');
            setRefundId(null);
          } catch (err) {
            toast.error(errorMessage(err, "We couldn't refund this payment."));
          }
        }}
      />
      <GarmentEditDialog
        garment={editGarment}
        description={editGarment ? lineById.get(editGarment.orderLineId)?.description : undefined}
        onOpenChange={(o) => !o && setEditGarment(null)}
      />
      <CreateTaskDialog
        open={dialog === 'task'}
        onOpenChange={(o) => setDialog(o ? 'task' : null)}
        defaultType="DELIVERY"
        defaults={{
          customerId: order.customer.id,
          orderId: order.id,
          storeId: order.store.id,
          addressId: order.deliveryAddress?.id ?? null,
        }}
      />
    </div>
  );
}

function StageProgress({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') return null;
  const current = stageIndex(status);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Order progress">
      {ORDER_STAGES.map((s, i) => (
        <li key={s} className="min-w-0">
          <div className={cn('h-1.5 rounded-full', i <= current ? 'bg-primary' : 'bg-slate-200')} />
          <p className={cn('mt-1 truncate text-[11px]', i === current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {ORDER_STATUS_LABEL[s]}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Fact({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  highlight?: 'red' | 'teal';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card px-3 py-2.5 shadow-xs',
        highlight === 'red' && 'border-rose-200 bg-rose-50/60',
        highlight === 'teal' && 'border-teal-300 bg-teal-50 text-teal-900',
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 truncate text-[15px] font-semibold">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm">
      <span className="text-xs font-medium text-amber-800">{label}: </span>
      <span className="text-amber-950">{text}</span>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className={cn('flex justify-between', negative && 'text-emerald-700')}>
      <span className={cn(!negative && 'text-muted-foreground')}>{label}</span>
      <span>
        {negative && '− '}
        <MoneyDisplay value={value} />
      </span>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-3 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
