'use client';

import { updateTaskSchema, type TaskListItem } from '@rinseops/shared';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useSession } from '@/lib/session';
import { useUpdateTask } from './api';

export function EditTaskDialog({ task, open, onOpenChange }: { task: TaskListItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me } = useSession();
  const update = useUpdateTask();
  const slots = me.tenant.settings.timeSlots;
  const form = useZodForm(updateTaskSchema, {
    defaultValues: { scheduledDate: task.scheduledDate, timeSlot: task.timeSlot, address: task.address, notes: task.notes ?? '' },
  });

  useEffect(() => {
    if (open) form.reset({ scheduledDate: task.scheduledDate, timeSlot: task.timeSlot, address: task.address, notes: task.notes ?? '' });
  }, [open, task, form]);

  const submit = form.handleSubmit((values) =>
    update.mutate(
      { id: task.id, input: values },
      {
        onSuccess: () => {
          toast.success('Task updated');
          onOpenChange(false);
        },
        onError: (err) => applyApiError(form, err, "We couldn't update this task."),
      },
    ),
  );
  const { errors } = form.formState;
  const slotOptions = slots.includes(task.timeSlot) ? slots : [task.timeSlot, ...slots];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Reschedule / edit {task.type === 'PICKUP' ? 'pickup' : 'delivery'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" error={errors.scheduledDate?.message}>
                <Input type="date" {...form.register('scheduledDate')} />
              </Field>
              <Field label="Time slot" error={errors.timeSlot?.message}>
                <NativeSelect {...form.register('timeSlot')}>
                  {slotOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Address" error={errors.address?.message}>
              <Textarea rows={2} {...form.register('address')} />
            </Field>
            <Field label="Notes" error={errors.notes?.message}>
              <Textarea rows={2} {...form.register('notes')} />
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
      </DialogContent>
    </Dialog>
  );
}
