'use client';

import { registerSchema, slugify } from '@rinseops/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { apiPost } from '@/lib/api-client';
import { applyApiError, useZodForm } from '@/lib/forms';

const CURRENCIES = [
  ['INR', 'Indian Rupee (₹)'],
  ['USD', 'US Dollar ($)'],
  ['EUR', 'Euro (€)'],
  ['GBP', 'British Pound (£)'],
  ['AED', 'UAE Dirham'],
  ['SGD', 'Singapore Dollar'],
  ['AUD', 'Australian Dollar'],
] as const;

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const form = useZodForm(registerSchema, {
    defaultValues: {
      businessName: '',
      ownerName: '',
      email: '',
      phone: undefined,
      password: '',
      storeName: 'Main Store',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
  });

  useEffect(() => {
    try {
      form.setValue('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
    } catch {
      /* keep default */
    }
  }, [form]);

  const mutation = useMutation({
    mutationFn: (values: unknown) => apiPost<{ home: string }>('/auth/register', values as Record<string, unknown>),
    onSuccess: (res) => {
      queryClient.clear();
      router.replace(res.home);
    },
    onError: (err) => applyApiError(form, err, "We couldn't create your account. Please try again."),
  });

  const { errors } = form.formState;
  const businessName = form.watch('businessName');

  const next = async () => {
    const ok = await form.trigger(['businessName', 'storeName', 'currency']);
    if (ok) setStep(2);
  };

  return (
    <>
      <p className="text-xs font-medium text-primary">Step {step} of 2</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{step === 1 ? 'Set up your business' : 'Create your owner account'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === 1 ? 'We’ll add starter services, prices and a rack you can edit later.' : 'You’ll be the owner with full access.'}
      </p>

      <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} noValidate>
        {step === 1 ? (
          <>
            <Field
              label="Business name"
              error={errors.businessName?.message}
              hint={businessName ? `Booking link: /book/${slugify(businessName)}` : undefined}
            >
              <Input
                autoFocus
                placeholder="e.g. FreshFold Laundry"
                {...form.register('businessName')}
                aria-invalid={!!errors.businessName}
              />
            </Field>
            <Field label="First store name" error={errors.storeName?.message}>
              <Input {...form.register('storeName')} aria-invalid={!!errors.storeName} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" error={errors.currency?.message}>
                <NativeSelect {...form.register('currency')}>
                  {CURRENCIES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Timezone" error={errors.timezone?.message}>
                <Input {...form.register('timezone')} />
              </Field>
            </div>
            <Button type="button" size="lg" onClick={() => void next()}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Field label="Your name" error={errors.ownerName?.message}>
              <Input autoFocus autoComplete="name" {...form.register('ownerName')} aria-invalid={!!errors.ownerName} />
            </Field>
            <Field label="Work email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('email')} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Phone (optional)" error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" {...form.register('phone', { setValueAs: (v: string) => (v ? v : undefined) })} />
            </Field>
            <Field label="Password" error={errors.password?.message} hint="At least 8 characters">
              <Input type="password" autoComplete="new-password" {...form.register('password')} aria-invalid={!!errors.password} />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" loading={mutation.isPending}>
                Create account
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
