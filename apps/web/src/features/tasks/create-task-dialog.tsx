'use client';

import {
  createTaskSchema,
  customerDisplayName,
  dateKeyInZone,
  ORDER_STATUS_LABEL,
  TASK_TYPES,
  TASK_TYPE_LABEL,
  type TaskType,
} from '@rinseops/shared';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useCustomer } from '@/features/customers/api';
import { CustomerFormDialog } from '@/features/customers/customer-form-dialog';
import { CustomerPicker } from '@/features/customers/customer-picker';
import { useCreateTask, useDrivers } from './api';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultType?: TaskType;
  /** Pre-fill when scheduling from an order or customer page. */
  defaults?: { customerId?: string; orderId?: string; storeId?: string; addressId?: string | null };
}

const FREE_TEXT = '__free__';

export function CreateTaskDialog(props: Props) {
  // The form is mounted only while open, so every opening starts fresh.
  return props.open ? <CreateTaskForm {...props} /> : null;
}

function CreateTaskForm({ open, onOpenChange, defaultType = 'PICKUP', defaults }: Props) {
  const { me, activeStoreId } = useSession();
  const f = useFormat();
  const today = useMemo(() => dateKeyInZone(new Date(), me.tenant.settings.timezone), [me.tenant.settings.timezone]);
  const slots = me.tenant.settings.timeSlots;

  const [type, setType] = useState<TaskType>(defaultType);
  const [storeId, setStoreId] = useState(defaults?.storeId ?? activeStoreId);
  const [customerId, setCustomerId] = useState<string | null>(defaults?.customerId ?? null);
  // null = use the customer's default address
  const [addressPick, setAddressPick] = useState<string | null>(defaults?.addressId ?? null);
  const [freeAddress, setFreeAddress] = useState('');
  const [orderId, setOrderId] = useState(defaults?.orderId ?? '');
  const [date, setDate] = useState(today);
  const [timeSlot, setTimeSlot] = useState(slots[0] ?? '');
  const [driverId, setDriverId] = useState('');
  const [requestedService, setRequestedService] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCustomer, setNewCustomer] = useState<{ phone?: string; firstName?: string } | null>(null);

  const customer = useCustomer(customerId ?? undefined);
  const drivers = useDrivers(storeId, open);
  const create = useCreateTask();

  const addresses = customer.data?.addresses ?? [];
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const addressChoice = addressPick ?? defaultAddress?.id ?? FREE_TEXT;
  const setAddressChoice = setAddressPick;
  const selectCustomer = (id: string | null) => {
    setCustomerId(id);
    setAddressPick(null);
    setOrderId('');
  };

  const openOrders = (customer.data?.openOrders ?? []).filter((o) => o.status !== 'DELIVERED');

  const submit = () => {
    const input = {
      type,
      storeId,
      customerId: customerId ?? '',
      orderId: type === 'DELIVERY' ? orderId || null : orderId || null,
      addressId: addressChoice !== FREE_TEXT ? addressChoice : null,
      address: addressChoice === FREE_TEXT ? freeAddress : null,
      scheduledDate: date,
      timeSlot,
      assignedDriverId: driverId || null,
      requestedService: requestedService || null,
      notes: notes || null,
    };
    const next: Record<string, string> = {};
    if (!customerId) next.customerId = 'Choose a customer';
    if (type === 'DELIVERY' && !orderId) next.orderId = 'Choose the order to deliver';
    if (date < today) next.scheduledDate = "Date can't be in the past";
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_');
        if (!next[key] && key !== 'customerId') next[key] = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;

    create.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`${TASK_TYPE_LABEL[type]} scheduled`);
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
        toast.error(errorMessage(err, "We couldn't schedule this task."));
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New pickup / delivery</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                    type === t ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="font-medium">{TASK_TYPE_LABEL[t]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t === 'PICKUP' ? 'Collect clothes from the customer' : 'Return a ready order to the customer'}
                  </span>
                </button>
              ))}
            </div>

            {me.stores.length > 1 && (
              <Field label="Store">
                <NativeSelect value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                  {me.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <Field label="Customer" required error={errors.customerId}>
              {customerId && customer.data ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customerDisplayName(customer.data)}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer.data.phone}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => selectCustomer(null)} aria-label="Change customer">
                    <X />
                  </Button>
                </div>
              ) : (
                <CustomerPicker autoFocus onSelect={(c) => selectCustomer(c.id)} onCreate={(prefill) => setNewCustomer(prefill)} />
              )}
            </Field>

            {customerId && (
              <>
                {type === 'DELIVERY' && (
                  <Field label="Order to deliver" required error={errors.orderId}>
                    <NativeSelect value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                      <option value="">{openOrders.length ? 'Choose an order…' : 'No open orders for this customer'}</option>
                      {openOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} · {ORDER_STATUS_LABEL[o.status]} · {o.totalPieces} pcs · due {f.shortDate(o.dueDate)}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <Field label="Address" required error={errors.address ?? errors.addressId}>
                  <NativeSelect value={addressChoice} onChange={(e) => setAddressChoice(e.target.value)}>
                    {customer.data?.addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}: {[a.addressLine1, a.addressLine2, a.city].filter(Boolean).join(', ')}
                      </option>
                    ))}
                    <option value={FREE_TEXT}>Enter a different address…</option>
                  </NativeSelect>
                  {addressChoice === FREE_TEXT && (
                    <Textarea
                      rows={2}
                      className="mt-1.5"
                      placeholder="House / flat, street, landmark, city"
                      value={freeAddress}
                      onChange={(e) => setFreeAddress(e.target.value)}
                    />
                  )}
                </Field>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date" required error={errors.scheduledDate}>
                <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Time slot" required error={errors.timeSlot}>
                <NativeSelect value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
                  {slots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Driver">
                <NativeSelect value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">Assign later</option>
                  {drivers.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {type === 'PICKUP' && (
              <Field label="Requested service">
                <Input
                  placeholder="e.g. Dry cleaning, wash & fold"
                  value={requestedService}
                  onChange={(e) => setRequestedService(e.target.value)}
                />
              </Field>
            )}
            <Field label="Notes">
              <Textarea rows={2} placeholder="Gate code, instructions…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Schedule {TASK_TYPE_LABEL[type].toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CustomerFormDialog
        open={newCustomer !== null}
        onOpenChange={(o) => !o && setNewCustomer(null)}
        initial={newCustomer ?? undefined}
        onSaved={(c) => selectCustomer(c.id)}
        onDuplicate={(id) => selectCustomer(id)}
      />
    </>
  );
}
