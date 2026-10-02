'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/** Asks for the weight when a per-kg item is added. */
export function WeightDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: { name: string } | null;
  onCancel: () => void;
  onConfirm: (kg: string) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent size="sm">{item && <WeightForm name={item.name} onCancel={onCancel} onConfirm={onConfirm} />}</DialogContent>
    </Dialog>
  );
}

function WeightForm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: (kg: string) => void }) {
  const [value, setValue] = useState('');
  const valid = /^\d{1,4}(\.\d{1,3})?$/.test(value) && Number(value) > 0;
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm(value);
      }}
    >
      <DialogHeader>
        <DialogTitle>Weight for {name}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="relative">
          <Input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.0"
            className="tabular h-12 pr-10 text-2xl"
            aria-label="Weight in kilograms"
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['1', '2', '3', '4', '5', '6'].map((v) => (
            <button key={v} type="button" onClick={() => setValue(v)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">
              {v} kg
            </button>
          ))}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Add
        </Button>
      </DialogFooter>
    </form>
  );
}
