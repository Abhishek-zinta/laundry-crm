'use client';

import { formatOrderNumber, formatTagCode, updateTenantSchema, type UpdateTenantInput } from '@rinseops/shared';
import { Check, Copy, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useSession } from '@/lib/session';
import { useUpdateSettings } from './api';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'ZAR', 'KES', 'NGN'];
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ id, label, description, children }: { id: string; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function BusinessSettings() {
  const { me } = useSession();
  const t = me.tenant;
  const s = t.settings;
  const update = useUpdateSettings();
  const [copied, setCopied] = useState(false);
  const bookingUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/book/${t.slug}`;

  const defaults = useMemo(
    () => ({
      name: t.name,
      logoUrl: t.logoUrl ?? '',
      phone: t.phone ?? '',
      email: t.email ?? '',
      address: t.address ?? '',
      brandColor: s.brandColor,
      currency: s.currency,
      locale: s.locale,
      timezone: s.timezone,
      taxName: s.taxName,
      taxRate: s.taxRate,
      taxInclusive: s.taxInclusive,
      taxNumber: s.taxNumber ?? '',
      orderPrefix: s.orderPrefix,
      invoicePrefix: s.invoicePrefix,
      garmentPrefix: s.garmentPrefix,
      receiptFooter: s.receiptFooter ?? '',
      defaultTurnaroundHours: s.defaultTurnaroundHours,
      skipQualityCheck: s.skipQualityCheck,
      bookingEnabled: s.bookingEnabled,
    }),
    [t, s],
  );

  const form = useZodForm(updateTenantSchema, { defaultValues: defaults });
  const [slotsDraft, setSlots] = useState<string[] | null>(null);
  const slots = slotsDraft ?? s.timeSlots;
  const [newSlot, setNewSlot] = useState('');

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const slotsChanged = slots.join('|') !== s.timeSlots.join('|');
  const { errors, dirtyFields } = form.formState;
  const dirtyCount = Object.keys(dirtyFields).length + (slotsChanged ? 1 : 0);

  const submit = form.handleSubmit(async (values) => {
    const input: Partial<UpdateTenantInput> = {};
    for (const k of Object.keys(dirtyFields) as Array<keyof UpdateTenantInput>) {
      (input as Record<string, unknown>)[k] = values[k];
    }
    if (slotsChanged) input.timeSlots = slots;
    if (!Object.keys(input).length) return;
    try {
      await update.mutateAsync(input as UpdateTenantInput);
      setSlots(null);
      toast.success('Settings saved');
    } catch (err) {
      applyApiError(form, err, "We couldn't save your settings.");
    }
  });

  const addSlot = () => {
    const v = newSlot.trim().replace(/\s+/g, '');
    if (!SLOT_RE.test(v)) {
      toast.error('Use the format HH:MM-HH:MM, e.g. 09:00-11:00');
      return;
    }
    if (slots.includes(v)) return;
    setSlots([...slots, v].sort());
    setNewSlot('');
  };

  const year = new Date().getFullYear();
  const orderPrefix = (form.watch('orderPrefix') || 'RO').toUpperCase();
  const garmentPrefix = (form.watch('garmentPrefix') || 'GAR').toUpperCase();
  const logoUrl = form.watch('logoUrl');

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 pb-20">
      <Section title="Business profile" description="Shown on receipts and the public booking page.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label="Logo URL" error={errors.logoUrl?.message}>
            <div className="flex items-center gap-2">
              <Input placeholder="https://…" {...form.register('logoUrl')} />
              {logoUrl && /^https?:\/\//.test(logoUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo preview" className="size-9 shrink-0 rounded border object-contain" />
              )}
            </div>
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...form.register('phone')} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...form.register('email')} />
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <Textarea rows={2} {...form.register('address')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Brand colour" error={errors.brandColor?.message}>
            <Input type="color" className="p-1" {...form.register('brandColor')} />
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            <NativeSelect {...form.register('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Locale" error={errors.locale?.message} hint="e.g. en-IN, en-US">
            <Input {...form.register('locale')} />
          </Field>
          <Field label="Timezone" error={errors.timezone?.message} hint="IANA name">
            <Input {...form.register('timezone')} />
          </Field>
        </div>
      </Section>

      <Section title="Tax" description="Applied to every new order. Existing orders keep the tax they were created with.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tax name" error={errors.taxName?.message}>
            <Input placeholder="GST" {...form.register('taxName')} />
          </Field>
          <Field label="Tax rate (%)" error={errors.taxRate?.message}>
            <Input inputMode="decimal" {...form.register('taxRate')} />
          </Field>
          <Field label="Tax / GST number" error={errors.taxNumber?.message}>
            <Input {...form.register('taxNumber')} />
          </Field>
        </div>
        <Controller
          control={form.control}
          name="taxInclusive"
          render={({ field }) => (
            <ToggleRow
              id="taxInclusive"
              label="Prices include tax"
              description="When on, tax is extracted from prices instead of added on top."
            >
              <Switch id="taxInclusive" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
            </ToggleRow>
          )}
        />
      </Section>

      <Section title="Numbering & receipts">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Order prefix" error={errors.orderPrefix?.message} hint={formatOrderNumber(orderPrefix, year, 123)}>
            <Input className="uppercase" {...form.register('orderPrefix')} />
          </Field>
          <Field label="Invoice prefix" error={errors.invoicePrefix?.message}>
            <Input className="uppercase" {...form.register('invoicePrefix')} />
          </Field>
          <Field label="Garment tag prefix" error={errors.garmentPrefix?.message} hint={formatTagCode(garmentPrefix, 123)}>
            <Input className="uppercase" {...form.register('garmentPrefix')} />
          </Field>
        </div>
        <Field label="Receipt footer" error={errors.receiptFooter?.message}>
          <Textarea rows={2} placeholder="Thank you for choosing us!" {...form.register('receiptFooter')} />
        </Field>
      </Section>

      <Section title="Workflow">
        <Field
          label="Default turnaround (hours)"
          error={errors.defaultTurnaroundHours?.message}
          hint="Used to suggest the due date at the counter."
          className="max-w-xs"
        >
          <Input type="number" min={1} {...form.register('defaultTurnaroundHours')} />
        </Field>
        <Controller
          control={form.control}
          name="skipQualityCheck"
          render={({ field }) => (
            <ToggleRow id="skipQc" label="Allow skipping quality check" description="Orders can move straight from Processing to Ready.">
              <Switch id="skipQc" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
            </ToggleRow>
          )}
        />
      </Section>

      <Section title="Online pickup booking" description="Customers can request a pickup without an account.">
        <Controller
          control={form.control}
          name="bookingEnabled"
          render={({ field }) => (
            <ToggleRow id="booking" label="Accept online bookings" description="Turn off to pause new pickup requests.">
              <Switch id="booking" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
            </ToggleRow>
          )}
        />
        <Field label="Booking link">
          <div className="flex gap-2">
            <Input readOnly value={bookingUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(bookingUrl).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </Field>
        <div className="grid gap-2">
          <Label>Pickup time slots</Label>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <span key={slot} className="tabular inline-flex items-center gap-1 rounded-md border bg-slate-50 py-1 pr-1 pl-2 text-sm">
                {slot}
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-slate-200 hover:text-foreground"
                  aria-label={`Remove ${slot}`}
                  onClick={() => setSlots(slots.filter((x) => x !== slot))}
                  disabled={slots.length <= 1}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex max-w-xs gap-2">
            <Input
              placeholder="09:00-11:00"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSlot();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addSlot}>
              <Plus /> Add
            </Button>
          </div>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-3 px-4 py-3 lg:px-6">
          <span className="text-sm text-muted-foreground">
            {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'All changes saved'}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!dirtyCount}
            onClick={() => {
              form.reset(defaults);
              setSlots(null);
            }}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!dirtyCount} loading={update.isPending}>
            Save settings
          </Button>
        </div>
      </div>
    </form>
  );
}
