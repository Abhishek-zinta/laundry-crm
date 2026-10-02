'use client';

import { addressSchema } from '@rinseops/shared';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useAddAddress } from './api';

const EMPTY = {
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isDefault: false,
};

export function AddressDialog({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const add = useAddAddress(customerId);
  const form = useZodForm(addressSchema, { defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values);
      toast.success('Address added');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this address. Please try again.");
    }
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Add address</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Label" error={errors.label?.message}>
                <Input placeholder="Home, Office…" {...form.register('label')} />
              </Field>
              <Field label="Address" required className="col-span-2" error={errors.addressLine1?.message}>
                <Input
                  autoFocus
                  placeholder="House / flat, street"
                  {...form.register('addressLine1')}
                  aria-invalid={!!errors.addressLine1}
                />
              </Field>
            </div>
            <Field label="Address line 2" error={errors.addressLine2?.message}>
              <Input {...form.register('addressLine2')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Landmark">
                <Input {...form.register('landmark')} />
              </Field>
              <Field label="City">
                <Input {...form.register('city')} />
              </Field>
              <Field label="State">
                <Input {...form.register('state')} />
              </Field>
              <Field label="PIN / ZIP">
                <Input {...form.register('postalCode')} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="addr-default"
                checked={form.watch('isDefault') === true}
                onCheckedChange={(v) => form.setValue('isDefault', v === true)}
              />
              <Label htmlFor="addr-default">Make this the default address</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending}>
              Save address
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
