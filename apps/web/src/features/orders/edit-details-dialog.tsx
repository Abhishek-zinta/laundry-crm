'use client';

import { DELIVERY_MODE_LABEL, Permission, type DeliveryMode, type DiscountType, type OrderDetail } from '@rinseops/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { useCustomer } from '../customers/api';
import { fromLocalInput, toLocalInput } from '../pos/due-date';
import { useUpdateOrder } from './api';

interface EditDetailsProps {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Edit due date, collection, discount and notes (allowed until delivery). */
export function EditDetailsDialog(props: EditDetailsProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="md">
        <EditDetailsForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function EditDetailsForm({ order, onOpenChange }: EditDetailsProps) {
  const { me, can } = useSession();
  const tz = me.tenant.settings.timezone;
  const update = useUpdateOrder(order.id);
  const customer = useCustomer(order.customer.id);
  const [due, setDue] = useState(() => toLocalInput(new Date(order.dueDate), tz));
  const [mode, setMode] = useState<DeliveryMode>(order.deliveryMode);
  const [pickedAddress, setAddressId] = useState(order.deliveryAddress?.id ?? '');
  const [notes, setNotes] = useState(order.notes ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(order.discountType ?? 'PERCENT');
  const [discountValue, setDiscountValue] = useState(order.discountValue ? String(Number(order.discountValue)) : '');
  const addresses = customer.data?.addresses ?? [];
  // Falls back to the customer's default address for home delivery.
  const addressId = pickedAddress || (addresses.find((a) => a.isDefault) ?? addresses[0])?.id || '';

  const save = async () => {
    const dueDate = fromLocalInput(due, tz);
    if (!dueDate) return toast.error('Choose a valid due date.');
    const originalDiscount = order.discountValue ? String(Number(order.discountValue)) : '';
    const discountChanged = discountValue !== originalDiscount || (discountValue && discountType !== order.discountType);
    try {
      await update.mutateAsync({
        dueDate: dueDate.toISOString(),
        deliveryMode: mode,
        deliveryAddressId: mode === 'HOME_DELIVERY' ? addressId || null : null,
        notes: notes || null,
        ...(discountChanged
          ? { discount: discountValue && Number(discountValue) > 0 ? { type: discountType, value: discountValue } : null }
          : {}),
      });
      toast.success('Order updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't update this order."));
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit {order.orderNumber}</DialogTitle>
      </DialogHeader>
      <DialogBody className="grid gap-3">
        <Field label="Due date">
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Collection">
            <NativeSelect value={mode} onChange={(e) => setMode(e.target.value as DeliveryMode)}>
              {(['STORE_PICKUP', 'HOME_DELIVERY'] as const).map((m) => (
                <option key={m} value={m}>
                  {DELIVERY_MODE_LABEL[m]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {mode === 'HOME_DELIVERY' && (
            <Field label="Address">
              <NativeSelect value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                <option value="">Select address</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}: {a.addressLine1}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        {can(Permission.ORDERS_DISCOUNT) && (
          <Field label="Discount" hint="Totals and balance are recalculated by the server.">
            <div className="flex gap-2">
              <NativeSelect className="w-28" value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Amount</option>
              </NativeSelect>
              <Input
                inputMode="decimal"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
              />
            </div>
          </Field>
        )}
        <Field label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
