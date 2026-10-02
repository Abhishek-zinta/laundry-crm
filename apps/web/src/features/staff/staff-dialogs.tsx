'use client';

import { ASSIGNABLE_ROLES, createStaffSchema, ROLE_LABEL, updateStaffSchema, type StaffDto } from '@rinseops/shared';
import { useEffect } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useSession } from '@/lib/session';
import { useCreateStaff, useUpdateStaff } from './api';

function StoreChecklist<T extends FieldValues>({ control, name, error }: { control: Control<T>; name: Path<T>; error?: string }) {
  const { me } = useSession();
  return (
    <Field label="Stores" error={error} hint="Which stores this person works at.">
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const value: string[] = (field.value as string[] | undefined) ?? [];
          return (
            <div className="grid gap-2 rounded-md border p-2.5 sm:grid-cols-2">
              {me.stores.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={value.includes(s.id)}
                    onCheckedChange={(checked) => field.onChange(checked === true ? [...value, s.id] : value.filter((id) => id !== s.id))}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          );
        }}
      />
    </Field>
  );
}

export function CreateStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me } = useSession();
  const roles = ASSIGNABLE_ROLES[me.user.role];
  const create = useCreateStaff();
  const form = useZodForm(createStaffSchema, {
    defaultValues: { name: '', email: '', phone: '', role: 'COUNTER_STAFF', storeIds: [], password: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        email: '',
        phone: '',
        role: roles.includes('COUNTER_STAFF') ? 'COUNTER_STAFF' : (roles[0] as 'COUNTER_STAFF'),
        storeIds: me.stores.length === 1 ? [me.stores[0]!.id] : [],
        password: '',
      });
    }
  }, [open, form, me.stores, roles]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      toast.success(`${values.name} added. Share the temporary password with them.`);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: err.message });
        return;
      }
      applyApiError(form, err, "We couldn't add this staff member.");
    }
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <Field label="Full name" required error={errors.name?.message}>
              <Input autoFocus {...form.register('name')} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email (login)" required error={errors.email?.message}>
                <Input type="email" autoComplete="off" {...form.register('email')} />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <Input type="tel" {...form.register('phone')} />
              </Field>
            </div>
            <Field label="Role" required error={errors.role?.message}>
              <NativeSelect {...form.register('role')}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <StoreChecklist control={form.control} name="storeIds" error={errors.storeIds?.message} />
            <Field
              label="Temporary password"
              required
              error={errors.password?.message}
              hint="At least 8 characters. They can change it after signing in."
            >
              <Input type="text" autoComplete="new-password" {...form.register('password')} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Add staff member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditStaffDialog({
  open,
  onOpenChange,
  staff,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  staff: StaffDto | null;
}) {
  const { me } = useSession();
  const update = useUpdateStaff();
  const isSelf = staff?.id === me.user.id;
  const roles = ASSIGNABLE_ROLES[me.user.role];
  const form = useZodForm(updateStaffSchema, { defaultValues: {} });

  useEffect(() => {
    if (open && staff) {
      form.reset({
        name: staff.name,
        phone: staff.phone ?? '',
        role: staff.role === 'OWNER' ? undefined : staff.role,
        storeIds: staff.stores.map((s) => s.id),
        password: undefined,
      });
    }
  }, [open, staff, form]);

  if (!staff) return null;

  const submit = form.handleSubmit(async (values) => {
    const input: typeof values = { name: values.name, phone: values.phone };
    if (!isSelf) {
      if (values.role && values.role !== staff.role) input.role = values.role;
      const before = staff.stores
        .map((s) => s.id)
        .sort()
        .join(',');
      if (values.storeIds && values.storeIds.slice().sort().join(',') !== before) input.storeIds = values.storeIds;
      if (values.password) input.password = values.password;
    }
    try {
      await update.mutateAsync({ id: staff.id, input });
      toast.success('Staff member updated');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't update this staff member.");
    }
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Edit {staff.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" error={errors.name?.message}>
                <Input {...form.register('name')} />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <Input type="tel" {...form.register('phone')} />
              </Field>
            </div>
            {isSelf ? (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                You can&apos;t change your own role, stores or status. Use “Change password” in the account menu for your password.
              </p>
            ) : (
              <>
                <Field label="Role" error={errors.role?.message}>
                  <NativeSelect {...form.register('role')}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <StoreChecklist control={form.control} name="storeIds" error={errors.storeIds?.message} />
                <Field
                  label="Reset password"
                  error={errors.password?.message}
                  hint="Leave blank to keep the current password. Resetting signs them out everywhere."
                >
                  <Input
                    type="text"
                    autoComplete="new-password"
                    {...form.register('password', { setValueAs: (v: string) => (v ? v : undefined) })}
                  />
                </Field>
              </>
            )}
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
      </DialogContent>
    </Dialog>
  );
}
