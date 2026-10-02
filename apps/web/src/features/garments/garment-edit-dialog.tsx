'use client';

import { GARMENT_COLORS, GARMENT_ISSUE_LABEL, GARMENT_ISSUES, STAIN_TYPES, type GarmentDto, type GarmentIssue } from '@rinseops/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useUpdateGarment } from './api';

/** Records condition at intake (stains, tears, missing buttons…) to avoid disputes. */
export function GarmentEditDialog({
  garment,
  description,
  onOpenChange,
}: {
  garment: GarmentDto | null;
  description?: string;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(garment)} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {garment && <GarmentForm key={garment.id} garment={garment} description={description} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function GarmentForm({
  garment,
  description,
  onOpenChange,
}: {
  garment: GarmentDto;
  description?: string;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateGarment(garment.id);
  const [color, setColor] = useState(garment.color ?? '');
  const [brand, setBrand] = useState(garment.brand ?? '');
  const [fabric, setFabric] = useState(garment.fabric ?? '');
  const [issues, setIssues] = useState<GarmentIssue[]>(garment.issues);
  // "Stains: Blood, Food" on the first line is managed by the stain chips.
  const [stains, setStains] = useState<string[]>(() => parseStains(garment.damageNotes).stains);
  const [damageNotes, setDamageNotes] = useState(() => parseStains(garment.damageNotes).rest);
  const [instructions, setInstructions] = useState(garment.specialInstructions ?? '');

  const save = async () => {
    try {
      await update.mutateAsync({
        color: color || null,
        brand: brand || null,
        fabric: fabric || null,
        issues: stains.length && !issues.includes('STAIN') ? [...issues, 'STAIN'] : issues,
        damageNotes: [stains.length ? `Stains: ${stains.join(', ')}` : '', damageNotes.trim()].filter(Boolean).join('\n') || null,
        specialInstructions: instructions || null,
      });
      toast.success(`${garment.tagCode} updated`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't save this garment."));
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-mono">{garment.tagCode}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogBody className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Colour">
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </Field>
          <Field label="Brand">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label="Fabric">
            <Input value={fabric} onChange={(e) => setFabric(e.target.value)} />
          </Field>
        </div>
        <Field label="Condition at drop-off">
          <div className="flex flex-wrap gap-1.5">
            {GARMENT_ISSUES.filter((i) => i !== 'STAIN').map((issue) => {
              const on = issues.includes(issue);
              return (
                <button
                  key={issue}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setIssues(on ? issues.filter((i) => i !== issue) : [...issues, issue])}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    on ? 'border-amber-300 bg-amber-50 text-amber-800' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {GARMENT_ISSUE_LABEL[issue]}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Stains">
          <div className="flex flex-wrap gap-1.5">
            {STAIN_TYPES.map((stain) => {
              const on = stains.includes(stain);
              return (
                <button
                  key={stain}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStains(on ? stains.filter((x) => x !== stain) : [...stains, stain])}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    on ? 'border-amber-300 bg-amber-50 text-amber-800' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {stain}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Colour swatch">
          <div className="flex flex-wrap gap-1.5">
            {GARMENT_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={color === c.name}
                onClick={() => setColor(color === c.name ? '' : c.name)}
                className={cn('size-7 rounded-md border border-slate-300', color === c.name && 'ring-2 ring-primary ring-offset-2')}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </Field>
        <Field label="Damage notes" hint="Describe existing damage so it is on record before cleaning.">
          <Textarea rows={2} value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} />
        </Field>
        <Field label="Special care instructions">
          <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function parseStains(notes: string | null): { stains: string[]; rest: string } {
  if (!notes?.startsWith('Stains: ')) return { stains: [], rest: notes ?? '' };
  const [first, ...rest] = notes.split('\n');
  return { stains: first!.slice(8).split(', ').filter(Boolean), rest: rest.join('\n') };
}
