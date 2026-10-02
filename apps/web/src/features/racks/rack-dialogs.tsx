'use client';

import { createRackSchema } from '@rinseops/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { errorMessage } from '@/lib/api-client';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useAddSlot, useCreateRack, useUpdateSlot } from './api';

export function CreateRackDialog({
  open,
  onOpenChange,
  storeId,
  nextCode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeId: string;
  nextCode: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <CreateRackForm storeId={storeId} nextCode={nextCode} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateRackForm({ storeId, nextCode, onDone }: { storeId: string; nextCode: string; onDone: () => void }) {
  const create = useCreateRack();
  const form = useZodForm(createRackSchema, {
    defaultValues: { storeId, name: `Rack ${nextCode}`, code: nextCode, slotCount: 10, slotCapacity: 1, displayOrder: 0 },
  });
  const { errors } = form.formState;
  const code = form.watch('code');
  const count = Number(form.watch('slotCount')) || 0;
  return (
    <form
      className="contents"
      onSubmit={form.handleSubmit(async (v) => {
        try {
          await create.mutateAsync(v);
          toast.success(`${v.name} created`);
          onDone();
        } catch (err) {
          applyApiError(form, err, "We couldn't create the rack.");
        }
      })}
    >
      <DialogHeader>
        <DialogTitle>New rack</DialogTitle>
      </DialogHeader>
      <DialogBody className="grid gap-3">
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Name" error={errors.name?.message}>
            <Input autoFocus {...form.register('name')} />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input className="font-mono uppercase" {...form.register('code')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Number of slots" error={errors.slotCount?.message}>
            <Input type="number" min={0} max={200} {...form.register('slotCount')} />
          </Field>
          <Field label="Orders per slot" error={errors.slotCapacity?.message}>
            <Input type="number" min={1} max={100} {...form.register('slotCapacity')} />
          </Field>
        </div>
        {count > 0 && code && (
          <p className="text-xs text-muted-foreground">
            Creates slots {String(code).toUpperCase()}01 – {String(code).toUpperCase()}
            {String(count).padStart(2, '0')}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Create rack
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddSlotDialog({
  rack,
  onOpenChange,
}: {
  rack: { id: string; name: string; code: string; nextSlot: string } | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(rack)} onOpenChange={onOpenChange}>
      <DialogContent size="sm">{rack && <AddSlotForm rack={rack} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function AddSlotForm({ rack, onDone }: { rack: { id: string; name: string; nextSlot: string }; onDone: () => void }) {
  const add = useAddSlot();
  const [code, setCode] = useState(rack.nextSlot);
  const [capacity, setCapacity] = useState('1');
  return (
    <form
      className="contents"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await add.mutateAsync({ rackId: rack.id, code, capacity });
          toast.success(`Slot ${code.toUpperCase()} added`);
          onDone();
        } catch (err) {
          toast.error(errorMessage(err, "We couldn't add the slot."));
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Add slot to {rack.name}</DialogTitle>
      </DialogHeader>
      <DialogBody className="grid grid-cols-2 gap-3">
        <Field label="Slot code">
          <Input autoFocus className="font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Capacity">
          <Input type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending}>
          Add slot
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditSlotDialog({
  slot,
  onOpenChange,
}: {
  slot: { id: string; code: string; capacity: number; isActive: boolean; used: number } | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(slot)} onOpenChange={onOpenChange}>
      <DialogContent size="sm">{slot && <EditSlotForm slot={slot} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function EditSlotForm({
  slot,
  onDone,
}: {
  slot: { id: string; code: string; capacity: number; isActive: boolean; used: number };
  onDone: () => void;
}) {
  const update = useUpdateSlot();
  const [capacity, setCapacity] = useState(String(slot.capacity));
  const [active, setActive] = useState(slot.isActive);
  return (
    <form
      className="contents"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await update.mutateAsync({ slotId: slot.id, capacity, isActive: active });
          toast.success(`Slot ${slot.code} updated`);
          onDone();
        } catch (err) {
          toast.error(errorMessage(err, "We couldn't update the slot."));
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Slot {slot.code}</DialogTitle>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <Field label="Capacity (orders)" hint={slot.used ? `Currently holds ${slot.used} order(s).` : undefined}>
          <Input type="number" min={Math.max(1, slot.used)} max={100} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm">
          In use
          <Switch checked={active} onCheckedChange={setActive} disabled={slot.used > 0 && active} />
        </label>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
