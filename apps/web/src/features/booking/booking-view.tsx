'use client';

import { publicBookingSchema, type PublicTenantProfile } from '@rinseops/shared';
import { CalendarCheck, CheckCircle2, Loader2, MapPin, Phone, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { useZodForm } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useCreateBooking, usePublicProfile, type BookingConfirmation } from './api';

function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));
}

function addDays(key: string, days: number) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BookingView({ slug }: { slug: string }) {
  const profile = usePublicProfile(slug);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  if (profile.isLoading) {
    return (
      <Shell>
        <div className="grid place-items-center py-24">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      </Shell>
    );
  }
  if (!profile.data) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="text-xl font-semibold">{notFound ? 'We couldn’t find this business' : 'Something went wrong'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {notFound ? 'Please check the booking link you were given.' : 'Please refresh the page or try again in a moment.'}
          </p>
        </div>
      </Shell>
    );
  }

  const p = profile.data;
  return (
    <Shell brandColor={p.brandColor}>
      <BrandHeader profile={p} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-16">
        {!p.bookingEnabled ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">Online booking is paused</h2>
            <p className="mt-2 text-sm text-slate-500">
              We’re not taking online pickup requests right now.
              {p.phone ? ' Please call us to schedule a pickup.' : ''}
            </p>
            {p.phone && (
              <a
                href={`tel:${p.phone}`}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 font-medium text-white"
              >
                <Phone className="size-4" />
                Call {p.phone}
              </a>
            )}
          </div>
        ) : confirmation ? (
          <Confirmation profile={p} confirmation={confirmation} onReset={() => setConfirmation(null)} />
        ) : (
          <BookingForm slug={slug} profile={p} onBooked={setConfirmation} />
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, brandColor = '#0f766e' }: { children: React.ReactNode; brandColor?: string }) {
  return (
    <div className="min-h-dvh bg-[#f6f7f9] text-slate-900" style={{ ['--brand' as string]: brandColor }}>
      {children}
    </div>
  );
}

function BrandHeader({ profile }: { profile: PublicTenantProfile }) {
  return (
    <header className="mx-auto w-full max-w-2xl px-4 pt-8 pb-6 sm:pt-12">
      <div className="flex items-center gap-3">
        {profile.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logoUrl} alt="" className="size-12 rounded-xl object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl bg-[var(--brand)] text-xl font-semibold text-white">
            {profile.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{profile.name}</p>
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--brand)]">
              <Phone className="size-3.5" />
              {profile.phone}
            </a>
          )}
        </div>
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Book a pickup</h1>
      <p className="mt-2 text-slate-500">
        Tell us where and when — our driver collects your clothes. No need to list every item; we’ll count and tag them at the store.
      </p>
    </header>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40',
        selected ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <Icon className="size-4 text-[var(--brand)]" />
        {title}
      </h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function BookingForm({
  slug,
  profile,
  onBooked,
}: {
  slug: string;
  profile: PublicTenantProfile;
  onBooked: (c: BookingConfirmation) => void;
}) {
  const booking = useCreateBooking(slug);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useZodForm(publicBookingSchema, {
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: { addressLine1: '', addressLine2: '', landmark: '', city: '', postalCode: '' },
      pickupDate: profile.minDate,
      timeSlot: '',
      requestedService: null,
      notes: '',
      storeId: profile.stores.length > 1 ? profile.stores[0]?.id : undefined,
      website: '',
    },
  });

  const quickDates = useMemo(() => [0, 1, 2].map((d) => addDays(profile.minDate, d)).filter((d) => d <= profile.maxDate), [profile]);
  const pickupDate = form.watch('pickupDate');
  const timeSlot = form.watch('timeSlot');
  const service = form.watch('requestedService');
  const { errors } = form.formState;

  useEffect(() => {
    form.register('timeSlot');
    form.register('requestedService');
  }, [form]);

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    booking.mutate(values, {
      onSuccess: (res) => {
        onBooked(res);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          for (const [key, message] of Object.entries(err.fields)) form.setError(key as never, { message });
          setFormError(
            err.status === 429 ? 'You’ve made several requests in a short time. Please wait a minute and try again.' : err.message,
          );
        } else setFormError('We couldn’t send your request. Please try again.');
      },
    });
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Section title="When should we come?" icon={CalendarCheck}>
        <div>
          <div className="flex flex-wrap gap-2">
            {quickDates.map((d, i) => (
              <Chip key={d} selected={pickupDate === d} onClick={() => form.setValue('pickupDate', d, { shouldValidate: true })}>
                {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDateKey(d, { weekday: 'short', day: 'numeric', month: 'short' })}
              </Chip>
            ))}
            <Input
              type="date"
              aria-label="Pickup date"
              min={profile.minDate}
              max={profile.maxDate}
              className="h-[38px] w-auto"
              {...form.register('pickupDate')}
            />
          </div>
          {errors.pickupDate && <p className="mt-1.5 text-xs text-rose-600">{errors.pickupDate.message}</p>}
          {pickupDate && <p className="mt-2 text-sm text-slate-500">{formatDateKey(pickupDate)}</p>}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium">Time slot</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {profile.timeSlots.map((s) => (
              <Chip key={s} selected={timeSlot === s} onClick={() => form.setValue('timeSlot', s, { shouldValidate: true })}>
                {s.replace('-', ' – ')}
              </Chip>
            ))}
          </div>
          {errors.timeSlot && <p className="mt-1.5 text-xs text-rose-600">Please choose a time slot</p>}
        </div>
        {profile.services.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-medium">
              What do you need? <span className="font-normal text-slate-400">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.services.map((s) => (
                <Chip key={s} selected={service === s} onClick={() => form.setValue('requestedService', service === s ? null : s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {profile.stores.length > 1 && (
          <Field label="Nearest store">
            <NativeSelect {...form.register('storeId')}>
              {profile.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </Section>

      <Section title="Pickup address" icon={MapPin}>
        <Field label="House / flat & street" required error={errors.address?.addressLine1?.message}>
          <Input autoComplete="address-line1" {...form.register('address.addressLine1')} aria-invalid={!!errors.address?.addressLine1} />
        </Field>
        <Field label="Area / apartment" error={errors.address?.addressLine2?.message}>
          <Input autoComplete="address-line2" {...form.register('address.addressLine2')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Landmark">
            <Input {...form.register('address.landmark')} />
          </Field>
          <Field label="City">
            <Input autoComplete="address-level2" {...form.register('address.city')} />
          </Field>
          <Field label="PIN / ZIP">
            <Input autoComplete="postal-code" inputMode="numeric" {...form.register('address.postalCode')} />
          </Field>
        </div>
      </Section>

      <Section title="Your details" icon={Phone}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            <Input autoComplete="name" {...form.register('name')} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Phone" required error={errors.phone?.message} hint="Our driver will call before arriving.">
            <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} aria-invalid={!!errors.phone} />
          </Field>
        </div>
        <Field label="Email (optional)" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Notes for the driver (optional)" error={errors.notes?.message}>
          <Textarea rows={3} placeholder="Gate code, delicate items, best way to reach you…" {...form.register('notes')} />
        </Field>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
          </label>
        </div>
      </Section>

      {formError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={booking.isPending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-6 text-base font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {booking.isPending && <Loader2 className="size-4 animate-spin" />}
        Request pickup
      </button>
      <p className="text-center text-xs text-slate-400">No payment needed now — you’ll pay when your order is ready.</p>
    </form>
  );
}

function Confirmation({
  profile,
  confirmation,
  onReset,
}: {
  profile: PublicTenantProfile;
  confirmation: BookingConfirmation;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
      <CheckCircle2 className="mx-auto size-12 text-[var(--brand)]" />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">Pickup requested!</h2>
      <p className="mt-2 text-slate-500">We’ve received your request. {profile.name} will confirm shortly.</p>
      <dl className="mx-auto mt-6 grid max-w-sm gap-3 rounded-xl bg-slate-50 p-4 text-left text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-mono font-semibold">{confirmation.reference}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Date</dt>
          <dd className="font-medium">{formatDateKey(confirmation.pickupDate)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Time</dt>
          <dd className="font-medium">{confirmation.timeSlot.replace('-', ' – ')}</dd>
        </div>
        {confirmation.storeName && (
          <div className="flex justify-between gap-4">
            <dt className="flex items-center gap-1 text-slate-500">
              <Store className="size-3.5" />
              Store
            </dt>
            <dd className="font-medium">{confirmation.storeName}</dd>
          </div>
        )}
      </dl>
      {profile.phone && (
        <p className="mt-5 text-sm text-slate-500">
          Need to change something? Call{' '}
          <a href={`tel:${profile.phone}`} className="font-medium text-[var(--brand)]">
            {profile.phone}
          </a>
        </p>
      )}
      <button type="button" onClick={onReset} className="mt-6 text-sm font-medium text-[var(--brand)] hover:underline">
        Book another pickup
      </button>
    </div>
  );
}
