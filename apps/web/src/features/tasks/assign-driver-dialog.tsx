'use client';

import type { TaskListItem } from '@rinseops/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useAssignTask, useDrivers } from './api';

export function AssignDriverDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskListItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const drivers = useDrivers(undefined, open);
  const assign = useAssignTask();
  const [driverId, setDriverId] = useState(task.assignedDriverId ?? '');

  const save = () =>
    assign.mutate(
      { id: task.id, driverId: driverId || null },
      {
        onSuccess: () => {
          toast.success(driverId ? 'Driver assigned' : 'Driver removed');
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err, "We couldn't assign the driver.")),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{task.assignedDriverId ? 'Reassign driver' : 'Assign driver'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field label="Driver" hint={drivers.data && !drivers.data.length ? 'No active drivers. Add one under Staff.' : undefined}>
            <NativeSelect value={driverId} onChange={(e) => setDriverId(e.target.value)} autoFocus>
              <option value="">Unassigned</option>
              {drivers.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.phone ? ` · ${d.phone}` : ''}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={assign.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
