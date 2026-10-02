'use client';

import { loginSchema } from '@rinseops/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost, ApiError } from '@/lib/api-client';
import { useZodForm } from '@/lib/forms';

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@freshfold.test' },
  { label: 'Manager', email: 'manager@freshfold.test' },
  { label: 'Counter', email: 'counter@freshfold.test' },
  { label: 'Processing', email: 'processing@freshfold.test' },
  { label: 'Driver', email: 'driver@freshfold.test' },
];
const showDemo = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const form = useZodForm(loginSchema, { defaultValues: { email: '', password: '' } });

  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => apiPost<{ home: string }>('/auth/login', values),
    onSuccess: async (res) => {
      queryClient.clear();
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : res.home);
    },
  });

  const error = mutation.error instanceof ApiError ? mutation.error.message : mutation.error ? 'Sign in failed. Please try again.' : null;
  const { errors } = form.formState;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back. Enter your work email to continue.</p>

      <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" autoFocus {...form.register('email')} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            aria-invalid={!!errors.password}
          />
        </Field>
        <Button type="submit" size="lg" loading={mutation.isPending}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to RinseOps?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Register your business
        </Link>
      </p>

      {showDemo && (
        <div className="mt-8 rounded-lg border border-dashed bg-slate-50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Demo accounts · password Password123!</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/50 hover:text-primary"
                onClick={() => {
                  form.setValue('email', a.email);
                  form.setValue('password', 'Password123!');
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
