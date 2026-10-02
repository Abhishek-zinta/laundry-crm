'use client';

import { createCustomerSchema, type CustomerDetail } from '@rinseops/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { apiGet, ApiError } from '@/lib/api-client';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useOptionalSession } from '@/lib/session';
import { useCreateCustomer, useUpdateCustomer } from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when provided. */
  customer?: CustomerDetail;
  /** Prefill for create mode (e.g. the phone typed at the counter). */
  initial?: { phone?: string; firstName?: string };
  onSaved?: (customer: CustomerDetail) => void;
  /** Called when the phone already belongs to a customer. */
  onDuplicate?: (customerId: string) => void;
}

export function CustomerFormDialog({ open, onOpenChange, customer, initial, onSaved, onDuplicate }: Props) {
  const isEdit = Boolean(customer);
  const session = useOptionalSession();
  const [withAddress, setWithAddress] = useState(false);
  // Collapse the address section each time the dialog opens (state adjusted during render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setWithAddress(false);
  }
  const create = useCreateCustomer();
  const update = useUpdateCustomer(customer?.id ?? '');
  const canPricing = session?.can('catalog.view') ?? false;
  const priceLists = useQuery({
    queryKey: ['catalog', 'overview'],
    queryFn: ({ signal }) => apiGet<{ priceLists: Array<{ id: string; name: string; isActive: boolean }> }>('/catalog', signal),
    enabled: open && canPricing,
    staleTime: 60_000,
  });

  const form = useZodForm(createCustomerSchema, {
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      alternatePhone: '',
      email: '',
      notes: '',
      priceListId: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      firstName: customer?.firstName ?? initial?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      phone: customer?.phone ?? initial?.phone ?? '',
      alternatePhone: customer?.alternatePhone ?? '',
      email: customer?.email ?? '',
      notes: customer?.notes ?? '',
      priceListId: customer?.priceListId ?? null,
    });
  }, [open, customer, initial, form]);

  const submit = form.handleSubmit(async (values) => {
    const { address, ...rest } = values;
    try {
      const saved = isEdit
        ? await update.mutateAsync(rest)
        : await create.mutateAsync({ ...rest, ...(withAddress && address ? { address } : {}) });
      toast.success(isEdit ? 'Customer updated' : 'Customer created');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_PHONE') {
        const existingId = (err.details as { customerId?: string } | undefined)?.customerId;
        form.setError('phone', { message: `Already used by ${(err.details as { name?: string })?.name ?? 'another customer'}` });
        if (existingId && onDuplicate) {
          toast.info('This phone number already belongs to a customer — selected them for you.');
          onDuplicate(existingId);
          onOpenChange(false);
        }
        return;
      }
      applyApiError(form, err, "We couldn't save this customer. Please try again.");
    }
  });

  const { errors } = form.formState;
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit customer' : 'New customer'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" required error={errors.firstName?.message}>
                <Input autoFocus={!initial?.phone || isEdit} {...form.register('firstName')} aria-invalid={!!errors.firstName} />
              </Field>
              <Field label="Last name" error={errors.lastName?.message}>
                <Input {...form.register('lastName')} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" required error={errors.phone?.message}>
                <Input type="tel" inputMode="tel" {...form.register('phone')} aria-invalid={!!errors.phone} />
              </Field>
              <Field label="Alternate phone" error={errors.alternatePhone?.message}>
                <Input type="tel" inputMode="tel" {...form.register('alternatePhone')} />
              </Field>
            </div>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...form.register('email')} />
            </Field>
            {canPricing && (
              <Field label="Price list" hint="Leave as default to use the store's standard prices.">
                <NativeSelect {...form.register('priceListId', { setValueAs: (v: string) => (v ? v : null) })}>
                  <option value="">Default pricing</option>
                  {priceLists.data?.priceLists
                    .filter((p) => p.isActive)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Notes" error={errors.notes?.message}>
              <Textarea rows={2} placeholder="Preferences, instructions…" {...form.register('notes')} />
            </Field>
            {!isEdit &&
              (withAddress ? (
                <div className="grid gap-3 rounded-lg border bg-slate-50/60 p-3">
                  <Field label="Address" required error={errors.address?.addressLine1?.message}>
                    <Input placeholder="House / flat, street" {...form.register('address.addressLine1')} />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Landmark">
                      <Input {...form.register('address.landmark')} />
                    </Field>
                    <Field label="City">
                      <Input {...form.register('address.city')} />
                    </Field>
                    <Field label="PIN / ZIP">
                      <Input {...form.register('address.postalCode')} />
                    </Field>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start text-primary"
                  onClick={() => setWithAddress(true)}
                >
                  + Add address
                </Button>
              ))}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? 'Save changes' : 'Create customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
