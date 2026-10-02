'use client';

import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS, toDecimal, type OrderDetail, type PaymentMethod } from '@rinseops/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { MoneyDisplay } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { cn, newIdempotencyKey } from '@/lib/utils';
import { useRecordPayment } from './api';

interface AddPaymentProps {
  order: Pick<OrderDetail, 'id' | 'orderNumber' | 'balanceDue' | 'grandTotal'>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid?: (balanceAfter: string) => void;
}

/** Records a (partial) payment against an order. Defaults to the full balance. */
export function AddPaymentDialog(props: AddPaymentProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="sm">
        <PaymentForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so each opening starts fresh.
function PaymentForm({ order, onOpenChange, onPaid }: AddPaymentProps) {
  const [amount, setAmount] = useState(() => toDecimal(order.balanceDue).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [key] = useState(() => newIdempotencyKey('pay'));
  const record = useRecordPayment();

  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const tooMuch = valid && toDecimal(amount).greaterThan(order.balanceDue);
  const after = valid ? toDecimal(order.balanceDue).minus(amount).toFixed(2) : order.balanceDue;

  const submit = async () => {
    if (!valid || tooMuch) return;
    try {
      const res = await record.mutateAsync({
        orderId: order.id,
        amount,
        method,
        reference: reference || null,
        idempotencyKey: key,
      });
      toast.success(
        toDecimal(res.order.balanceDue).isZero()
          ? `Fully paid — ${order.orderNumber}`
          : `Payment recorded. Balance ${res.order.balanceDue}`,
      );
      onPaid?.(res.order.balanceDue);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't save this payment. Please try again."));
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add payment</DialogTitle>
        <DialogDescription>
          {order.orderNumber} · outstanding <MoneyDisplay value={order.balanceDue} className="font-medium text-foreground" />
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                'rounded-md border px-1 py-2 text-xs font-medium',
                method === m ? 'border-slate-900 bg-slate-900 text-white' : 'hover:bg-slate-50',
              )}
              aria-pressed={method === m}
            >
              {m === 'BANK_TRANSFER' ? 'Bank' : PAYMENT_METHOD_LABEL[m]}
            </button>
          ))}
        </div>
        <Field label="Amount" error={tooMuch ? 'More than the outstanding balance' : undefined}>
          <Input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            className="tabular h-11 text-lg"
            aria-invalid={tooMuch}
          />
        </Field>
        {method !== 'CASH' && (
          <Field label="Reference (optional)">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI / card / transfer reference" />
          </Field>
        )}
        <p className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Balance after payment</span>
          <MoneyDisplay value={after} className="font-semibold" />
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={record.isPending} disabled={!valid || tooMuch}>
          Record payment
        </Button>
      </DialogFooter>
    </form>
  );
}
