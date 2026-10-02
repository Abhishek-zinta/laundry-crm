'use client';

import type { RackLocation } from '@rinseops/shared';
import { Boxes } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAssignRack, useRackBoard } from './api';

interface AssignRackProps {
  order: { id: string; orderNumber: string; store: { id: string }; rack: RackLocation | null };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Pick a slot visually or type its code (e.g. "A03" + Enter). */
export function AssignRackDialog(props: AssignRackProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        <AssignRackBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function AssignRackBody({ order, onOpenChange }: AssignRackProps) {
  const board = useRackBoard(order.store.id);
  const assign = useAssignRack(order.id);
  const [code, setCode] = useState('');

  const slots = useMemo(
    () => (board.data?.racks ?? []).filter((r) => r.isActive).flatMap((r) => r.slots.map((s) => ({ ...s, rackName: r.name }))),
    [board.data],
  );
  const typed = slots.find((s) => s.code.toUpperCase() === code.trim().toUpperCase());

  const choose = async (slotId: string, slotCode: string, rackName: string) => {
    try {
      await assign.mutateAsync({ rackSlotId: slotId });
      toast.success(`${order.orderNumber} placed on ${rackName} → ${slotCode}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't assign that rack slot."));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{order.rack ? 'Move to another slot' : 'Assign rack'}</DialogTitle>
        <DialogDescription>
          {order.orderNumber}
          {order.rack && (
            <>
              {' '}
              · currently on{' '}
              <span className="font-medium text-foreground">
                {order.rack.rackName} → {order.rack.slotCode}
              </span>
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed?.available) void choose(typed.id, typed.code, typed.rackName);
          }}
        >
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Type a slot code, e.g. A03"
            className="font-mono uppercase"
            aria-label="Slot code"
          />
          <Button type="submit" disabled={!typed?.available} loading={assign.isPending}>
            Assign
          </Button>
        </form>
        {code && !typed && <p className="-mt-2 text-xs text-muted-foreground">No slot called {code}.</p>}
        {typed && !typed.available && <p className="-mt-2 text-xs text-rose-600">{typed.code} is full or inactive.</p>}

        {board.isLoading ? (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !board.data?.racks.length ? (
          <EmptyState compact icon={Boxes} title="No racks in this store" description="Create racks on the Racks page first." />
        ) : (
          board.data.racks
            .filter((r) => r.isActive)
            .map((rack) => (
              <div key={rack.id}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{rack.name}</p>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                  {rack.slots.map((slot) => {
                    const current = order.rack?.slotId === slot.id;
                    const used = slot.orders.length;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!slot.available || current || assign.isPending}
                        onClick={() => void choose(slot.id, slot.code, rack.name)}
                        className={cn(
                          'flex h-14 flex-col items-center justify-center rounded-md border text-sm transition-colors',
                          current && 'border-primary bg-primary text-white',
                          !current && slot.available && 'bg-emerald-50/60 hover:border-emerald-500 hover:bg-emerald-100',
                          !current && !slot.available && 'cursor-not-allowed bg-slate-100 text-slate-400',
                        )}
                        title={slot.orders.map((o) => o.orderNumber).join(', ')}
                      >
                        <span className="font-mono font-semibold">{slot.code}</span>
                        <span className="text-[10px]">
                          {current ? 'current' : slot.capacity > 1 ? `${used}/${slot.capacity}` : used ? 'full' : 'free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
