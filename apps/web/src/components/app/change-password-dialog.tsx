'use client';

import { changePasswordSchema } from '@rinseops/shared';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api-client';
import { applyApiError, useZodForm } from '@/lib/forms';

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useZodForm(changePasswordSchema, { defaultValues: { currentPassword: '', newPassword: '' } });
  const mutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) => apiPost('/auth/change-password', values),
    onSuccess: () => {
      toast.success('Password updated. Other devices were signed out.');
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => applyApiError(form, err, "We couldn't update your password."),
  });
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="contents">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <Field label="Current password" error={errors.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </Field>
            <Field label="New password" error={errors.newPassword?.message} hint="At least 8 characters">
              <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
