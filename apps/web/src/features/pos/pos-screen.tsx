'use client';

import {
  customerDisplayName,
  DELIVERY_MODE_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  Permission,
  toDecimal,
  type CustomerDetail,
  type DeliveryMode,
  type OrderDetail,
  type PaymentMethod,
  type PosCatalog,
} from '@rinseops/shared';
import { AlertTriangle, Boxes, ShoppingBasket, Truck, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useReducer, useRef, useState } from 'react';
import { useNow } from '@/lib/use-now';
import { toast } from 'sonner';
import { MoneyDisplay } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useHotkey } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { cn, newIdempotencyKey } from '@/lib/utils';
import { useCustomer } from '../customers/api';
import { CustomerFormDialog } from '../customers/customer-form-dialog';
import { CustomerPicker } from '../customers/customer-picker';
import { useCreateOrder, usePosCatalog, useUpdateOrder } from '../orders/api';
import { cartReducer, emptyCart, priceCart, toOrderLines, type CartState } from './cart';
import { CartLines, DiscountRow, TotalsBlock } from './cart-panel';
import { CatalogPanel } from './catalog-panel';
import { defaultDueDate, DUE_PRESETS, dueAtDays, fromLocalInput, toLocalInput } from './due-date';
import { OrderSuccessDialog } from './success-dialog';
import { WeightDialog } from './weight-dialog';

interface PosScreenProps {
  initialCustomerId?: string;
  pickupTaskId?: string;
  /** Edit an existing (RECEIVED) order instead of creating one. */
  editOrder?: OrderDetail;
}

export function PosScreen({ initialCustomerId, pickupTaskId, editOrder }: PosScreenProps) {
  const { me, can, activeStoreId } = useSession();
  const settings = me.tenant.settings;
  const tz = settings.timezone;
  const f = useFormat();
  const router = useRouter();
  const isEdit = Boolean(editOrder);
  const storeId = editOrder?.store.id ?? activeStoreId;

  const [customerId, setCustomerId] = useState<string | undefined>(editOrder?.customer.id ?? initialCustomerId);
  const [taskId, setTaskId] = useState<string | undefined>(pickupTaskId);
  const customerQuery = useCustomer(customerId);
  const customer = customerQuery.data;

  const catalogQuery = usePosCatalog({
    storeId,
    customerId,
    priceListId: editOrder?.priceList?.id,
  });
  const catalog = catalogQuery.data;

  const [cart, dispatch] = useReducer(cartReducer, editOrder ? cartFromOrder(editOrder) : emptyCart);
  const summary = useMemo(() => priceCart(cart, catalog, settings), [cart, catalog, settings]);

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(editOrder?.deliveryMode ?? 'STORE_PICKUP');
  const [pickedAddressId, setAddressId] = useState<string>(editOrder?.deliveryAddress?.id ?? '');
  const [dueLocal, setDueLocal] = useState(() =>
    toLocalInput(editOrder ? new Date(editOrder.dueDate) : defaultDueDate(settings.defaultTurnaroundHours, tz), tz),
  );
  const [notes, setNotes] = useState(editOrder?.notes ?? '');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [reference, setReference] = useState('');
  const [weightFor, setWeightFor] = useState<{ categoryId: string; itemId: string; name: string } | null>(null);
  const [createOpen, setCreateOpen] = useState<{ phone?: string; firstName?: string } | null>(null);
  const [created, setCreated] = useState<OrderDetail | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey('order'));

  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder(editOrder?.id ?? '');
  const saving = createOrder.isPending || updateOrder.isPending;

  // Default delivery address follows the selected customer unless one was picked.
  const customerAddresses = customer?.addresses ?? [];
  const addressId = customerAddresses.some((a) => a.id === pickedAddressId)
    ? pickedAddressId
    : ((customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0])?.id ?? '');
  const now = useNow(60_000);

  const inCart = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of summary.lines) {
      const k = `${l.serviceCategoryId}:${l.serviceItemId}`;
      m.set(k, (m.get(k) ?? 0) + (l.unitType === 'KG' ? 1 : Number(l.quantity) || 0));
    }
    return m;
  }, [summary.lines]);

  const grandTotal = summary.totals.grandTotal;
  const paid = payAmount && /^\d+(\.\d{1,2})?$/.test(payAmount) ? payAmount : '0';
  const overpaid = toDecimal(paid).greaterThan(grandTotal);
  const outstanding = toDecimal(grandTotal).minus(toDecimal(paid)).toFixed(2);
  const dueDate = fromLocalInput(dueLocal, tz);
  const dueInPast = dueDate ? dueDate.getTime() < now - 60 * 60 * 1000 : true;

  const blockers: string[] = [];
  if (!customer) blockers.push('Select a customer');
  if (!summary.lines.length) blockers.push('Add at least one item');
  if (summary.hasInvalid) blockers.push('Remove items that are not priced');
  if (summary.hasInvalidQty) blockers.push('Fix item quantities');
  if (!dueDate || dueInPast) blockers.push('Choose a due date in the future');
  if (deliveryMode === 'HOME_DELIVERY' && !addressId) blockers.push('Add a delivery address');
  if (overpaid) blockers.push('Payment is more than the total');

  const addItem = (categoryId: string, item: PosCatalog['categories'][number]['items'][number]) => {
    if (item.unitType === 'KG') setWeightFor({ categoryId, itemId: item.serviceItemId, name: item.name });
    else dispatch({ type: 'add', serviceCategoryId: categoryId, serviceItemId: item.serviceItemId });
  };

  const resetForNext = () => {
    setCreated(null);
    dispatch({ type: 'reset' });
    setCustomerId(undefined);
    setTaskId(undefined);
    setDeliveryMode('STORE_PICKUP');
    setDueLocal(toLocalInput(defaultDueDate(settings.defaultTurnaroundHours, tz), tz));
    setNotes('');
    setPayAmount('');
    setReference('');
    setPayMethod('CASH');
    idempotencyKey.current = newIdempotencyKey('order');
    router.replace('/orders/new', { scroll: false });
  };

  const submit = async () => {
    if (blockers.length || saving || !customer || !dueDate) {
      if (blockers.length) toast.error(blockers[0]);
      return;
    }
    const discount = cart.discountValue && Number(cart.discountValue) > 0 ? { type: cart.discountType, value: cart.discountValue } : null;
    try {
      if (isEdit && editOrder) {
        const order = await updateOrder.mutateAsync({
          lines: toOrderLines(summary.lines),
          discount,
          dueDate: dueDate.toISOString(),
          deliveryMode,
          deliveryAddressId: deliveryMode === 'HOME_DELIVERY' ? addressId || null : null,
          notes: notes || null,
        });
        toast.success('Order updated');
        router.push(`/orders/${order.id}`);
        return;
      }
      const order = await createOrder.mutateAsync({
        customerId: customer.id,
        storeId,
        lines: toOrderLines(summary.lines),
        discount,
        dueDate: dueDate.toISOString(),
        deliveryMode,
        deliveryAddressId: deliveryMode === 'HOME_DELIVERY' ? addressId || null : null,
        notes: notes || null,
        payments: toDecimal(paid).greaterThan(0) ? [{ method: payMethod, amount: paid, reference: reference || null }] : [],
        pickupTaskId: taskId ?? null,
        idempotencyKey: idempotencyKey.current,
      });
      setCartOpen(false);
      setCreated(order);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't save this order. Please try again."));
    }
  };

  useHotkey('Enter', () => void submit(), { mod: true, allowInInputs: true, enabled: !created });

  const checkout = (
    <CheckoutPanel
      cart={cart}
      dispatch={dispatch}
      summary={summary}
      catalog={catalog}
      customer={customer}
      isEdit={isEdit}
      canDiscount={can(Permission.ORDERS_DISCOUNT)}
      canPay={can(Permission.PAYMENTS_CREATE)}
      deliveryMode={deliveryMode}
      setDeliveryMode={setDeliveryMode}
      addressId={addressId}
      setAddressId={setAddressId}
      dueLocal={dueLocal}
      setDueLocal={setDueLocal}
      dueInPast={dueInPast}
      notes={notes}
      setNotes={setNotes}
      payMethod={payMethod}
      setPayMethod={setPayMethod}
      payAmount={payAmount}
      setPayAmount={setPayAmount}
      reference={reference}
      setReference={setReference}
      outstanding={outstanding}
      overpaid={overpaid}
      blockers={blockers}
      saving={saving}
      onSubmit={() => void submit()}
    />
  );

  return (
    <div className="-mx-3 -my-4 sm:-mx-4 sm:-my-5 lg:-mx-6">
      <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px]">
        {/* Left: customer + catalog */}
        <section className="min-w-0 overflow-y-auto px-3 py-4 sm:px-4 lg:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{isEdit ? `Edit ${editOrder!.orderNumber}` : 'New order'}</h1>
              <p className="text-xs text-muted-foreground">
                {me.stores.find((s) => s.id === storeId)?.name}
                {catalog && <> · {catalog.priceList.name} prices</>}
                {!isEdit && <span className="hidden sm:inline"> · ⌘/Ctrl + Enter to save</span>}
              </p>
            </div>
            {taskId && (
              <Badge tone="teal">
                <Truck />
                From pickup request
                <button type="button" onClick={() => setTaskId(undefined)} aria-label="Unlink pickup" className="ml-1">
                  <X />
                </button>
              </Badge>
            )}
          </div>

          <CustomerBlock
            customer={customer}
            loading={customerQuery.isLoading && Boolean(customerId)}
            locked={isEdit}
            onSelect={(id) => setCustomerId(id)}
            onClear={() => setCustomerId(undefined)}
            onCreate={(prefill) => setCreateOpen(prefill)}
          />

          <div className="mt-5">
            <CatalogPanel catalog={catalog} loading={catalogQuery.isLoading} inCart={inCart} onAdd={addItem} />
          </div>
        </section>

        {/* Right: cart & checkout (desktop) */}
        <aside className="hidden min-h-0 border-l bg-card lg:flex lg:flex-col">{checkout}</aside>
      </div>

      {/* Mobile cart bar */}
      <div className="sticky bottom-0 z-20 border-t bg-card/95 p-3 backdrop-blur lg:hidden">
        <Button className="h-12 w-full justify-between text-base" onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2">
            <ShoppingBasket />
            {summary.lines.length} item{summary.lines.length === 1 ? '' : 's'} · {summary.pieces} pcs
          </span>
          <span className="tabular">{f.money(grandTotal)} →</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full max-w-md p-0">
          <SheetTitle className="sr-only">Cart</SheetTitle>
          {checkout}
        </SheetContent>
      </Sheet>

      <WeightDialog
        item={weightFor}
        onCancel={() => setWeightFor(null)}
        onConfirm={(kg) => {
          if (weightFor) dispatch({ type: 'add', serviceCategoryId: weightFor.categoryId, serviceItemId: weightFor.itemId, quantity: kg });
          setWeightFor(null);
        }}
      />
      <CustomerFormDialog
        open={Boolean(createOpen)}
        onOpenChange={(o) => !o && setCreateOpen(null)}
        initial={createOpen ?? undefined}
        onSaved={(c) => setCustomerId(c.id)}
        onDuplicate={(id) => setCustomerId(id)}
      />
      <OrderSuccessDialog order={created} onNewOrder={resetForNext} />
    </div>
  );
}

function cartFromOrder(order: OrderDetail): CartState {
  return {
    discountType: order.discountType ?? 'PERCENT',
    discountValue: order.discountValue ? String(Number(order.discountValue)) : '',
    lines: order.lines.map((l) => {
      const first = order.garments.find((g) => g.orderLineId === l.id);
      return {
        key: l.id,
        serviceCategoryId: l.serviceCategoryId,
        serviceItemId: l.serviceItemId,
        quantity: String(Number(l.quantity)),
        modifierIds: l.modifiers.map((m) => m.modifierId).filter((x): x is string => Boolean(x)),
        notes: l.notes ?? '',
        color: first?.color ?? '',
        issues: first?.issues ?? [],
        stains: first?.damageNotes?.startsWith('Stains: ') ? first.damageNotes.slice(8).split(', ') : [],
      };
    }),
  };
}

// ---------------------------------------------------------------------------

function CustomerBlock({
  customer,
  loading,
  locked,
  onSelect,
  onClear,
  onCreate,
}: {
  customer: CustomerDetail | undefined;
  loading: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
  onClear: () => void;
  onCreate: (prefill: { phone?: string; firstName?: string }) => void;
}) {
  if (loading) return <div className="h-[74px] animate-pulse rounded-lg border bg-slate-100" />;
  if (!customer) {
    return (
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary-soft/30 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
          <UserRound className="size-3.5" />
          Who is this order for?
        </p>
        <CustomerPicker autoFocus onSelect={(c) => onSelect(c.id)} onCreate={onCreate} />
      </div>
    );
  }
  const ready = customer.openOrders.filter((o) => o.status === 'READY');
  const outstanding = Number(customer.stats.outstanding);
  return (
    <div className="rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {customer.firstName[0]}
          {customer.lastName?.[0] ?? ''}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/customers/${customer.id}`} className="truncate font-semibold hover:underline">
              {customerDisplayName(customer)}
            </Link>
            {customer.priceList && <Badge tone="violet">{customer.priceList.name}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {customer.phone} · {customer.stats.totalOrders} orders
          </p>
          {customer.notes && <p className="mt-1 line-clamp-1 text-xs text-amber-700">Note: {customer.notes}</p>}
        </div>
        {!locked && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Change
          </Button>
        )}
      </div>
      {(outstanding > 0 || ready.length > 0) && (
        <div className="mt-3 grid gap-1.5 border-t pt-2.5">
          {outstanding > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-rose-700">
              <AlertTriangle className="size-3.5" />
              Previous balance outstanding: <MoneyDisplay value={customer.stats.outstanding} className="font-semibold" />
            </p>
          )}
          {ready.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900 hover:bg-emerald-100"
            >
              <StatusBadge status={o.status} />
              <span className="font-mono font-medium">{o.orderNumber}</span>
              {o.rack && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Boxes className="size-3.5" />
                  {o.rack.rackName} → {o.rack.slot}
                </span>
              )}
              <span className="ml-auto">
                Balance <MoneyDisplay value={o.balanceDue} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface CheckoutPanelProps {
  cart: CartState;
  dispatch: Parameters<typeof CartLines>[0]['dispatch'];
  summary: ReturnType<typeof priceCart>;
  catalog: PosCatalog | undefined;
  customer: CustomerDetail | undefined;
  isEdit: boolean;
  canDiscount: boolean;
  canPay: boolean;
  deliveryMode: DeliveryMode;
  setDeliveryMode: (m: DeliveryMode) => void;
  addressId: string;
  setAddressId: (id: string) => void;
  dueLocal: string;
  setDueLocal: (v: string) => void;
  dueInPast: boolean;
  notes: string;
  setNotes: (v: string) => void;
  payMethod: PaymentMethod;
  setPayMethod: (m: PaymentMethod) => void;
  payAmount: string;
  setPayAmount: (v: string) => void;
  reference: string;
  setReference: (v: string) => void;
  outstanding: string;
  overpaid: boolean;
  blockers: string[];
  saving: boolean;
  onSubmit: () => void;
}

function CheckoutPanel(p: CheckoutPanelProps) {
  const { me } = useSession();
  const s = me.tenant.settings;
  const f = useFormat();
  const total = p.summary.totals.grandTotal;
  const sectionTitle = 'mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">
          Order items
          <span className="ml-1.5 font-normal text-muted-foreground">
            {p.summary.lines.length} · {p.summary.pieces} pcs
          </span>
        </p>
        {p.summary.lines.length > 0 && !p.isEdit && (
          <button type="button" className="text-xs text-muted-foreground hover:text-rose-600" onClick={() => p.dispatch({ type: 'reset' })}>
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <CartLines summary={p.summary} modifiers={p.catalog?.modifiers ?? []} dispatch={p.dispatch} />

        {p.summary.lines.length > 0 && (
          <div className="grid gap-5 border-t py-4">
            <DiscountRow state={p.cart} dispatch={p.dispatch} canDiscount={p.canDiscount} />

            <div>
              <p className={sectionTitle}>Collection</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(['STORE_PICKUP', 'HOME_DELIVERY'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => p.setDeliveryMode(m)}
                    className={cn(
                      'rounded-md border px-2 py-2 text-sm font-medium',
                      p.deliveryMode === m ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-slate-50',
                    )}
                    aria-pressed={p.deliveryMode === m}
                  >
                    {DELIVERY_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              {p.deliveryMode === 'HOME_DELIVERY' &&
                (p.customer?.addresses.length ? (
                  <NativeSelect
                    className="mt-2"
                    value={p.addressId}
                    onChange={(e) => p.setAddressId(e.target.value)}
                    aria-label="Delivery address"
                  >
                    {p.customer.addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}: {a.addressLine1}
                        {a.city ? `, ${a.city}` : ''}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <p className="mt-2 text-xs text-rose-600">
                    No saved address.{' '}
                    {p.customer && (
                      <Link className="underline" href={`/customers/${p.customer.id}`}>
                        Add one on the customer profile
                      </Link>
                    )}
                  </p>
                ))}
            </div>

            <div>
              <p className={sectionTitle}>Due date</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {DUE_PRESETS.map((d) => {
                  const value = toLocalInput(dueAtDays(d.days, s.timezone), s.timezone);
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => p.setDueLocal(value)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs',
                        p.dueLocal === value ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-slate-50',
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <Input
                type="datetime-local"
                value={p.dueLocal}
                onChange={(e) => p.setDueLocal(e.target.value)}
                aria-invalid={p.dueInPast}
                aria-label="Due date and time"
              />
            </div>

            <div>
              <p className={sectionTitle}>Order notes</p>
              <Textarea
                rows={2}
                value={p.notes}
                onChange={(e) => p.setNotes(e.target.value)}
                placeholder="Visible on the order and receipt"
              />
            </div>

            {!p.isEdit && p.canPay && (
              <div>
                <p className={sectionTitle}>Payment now</p>
                <div className="grid grid-cols-5 gap-1">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => p.setPayMethod(m)}
                      className={cn(
                        'truncate rounded-md border px-1 py-1.5 text-xs font-medium',
                        p.payMethod === m ? 'border-slate-900 bg-slate-900 text-white' : 'hover:bg-slate-50',
                      )}
                      aria-pressed={p.payMethod === m}
                    >
                      {m === 'BANK_TRANSFER' ? 'Bank' : PAYMENT_METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <Input
                    inputMode="decimal"
                    value={p.payAmount}
                    onChange={(e) => p.setPayAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder="Amount received"
                    className="tabular"
                    aria-invalid={p.overpaid}
                    aria-label="Amount received"
                  />
                  <Button type="button" variant="outline" size="default" onClick={() => p.setPayAmount(Number(total).toFixed(2))}>
                    Full
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => p.setPayAmount('')}>
                    None
                  </Button>
                </div>
                {p.payMethod !== 'CASH' && Number(p.payAmount) > 0 && (
                  <Input
                    className="mt-1.5"
                    value={p.reference}
                    onChange={(e) => p.setReference(e.target.value)}
                    placeholder="Reference / transaction ID (optional)"
                  />
                )}
                {p.overpaid && <p className="mt-1 text-xs text-rose-600">Amount is more than the order total.</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t bg-slate-50/60 px-4 py-3">
        <TotalsBlock summary={p.summary} taxName={s.taxName} taxRate={s.taxRate} taxInclusive={s.taxInclusive} />
        {!p.isEdit && Number(total) > 0 && (
          <div className="mt-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">
              Paid now <MoneyDisplay value={p.payAmount || 0} className="text-foreground" />
            </span>
            <span>
              Balance <MoneyDisplay value={p.outstanding} emphasizeDue className="font-semibold" />
            </span>
          </div>
        )}
        <Button className="mt-3 h-11 w-full text-base" onClick={p.onSubmit} loading={p.saving} disabled={p.blockers.length > 0}>
          {p.isEdit ? 'Save changes' : `Create order · ${f.money(total)}`}
        </Button>
        {p.blockers.length > 0 && p.summary.lines.length > 0 && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground">{p.blockers[0]}</p>
        )}
      </div>
    </div>
  );
}
