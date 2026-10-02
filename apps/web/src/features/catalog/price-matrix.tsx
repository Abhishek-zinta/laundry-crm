'use client';

import { GarmentIcon } from '@/components/shared/garment-icon';
import { MONEY_RE, UNIT_TYPE_LABEL, type CatalogOverview } from '@rinseops/shared';
import { Save, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePriceMatrix, useUpsertPrices } from './api';

const key = (categoryId: string, itemId: string) => `${categoryId}:${itemId}`;

interface Props {
  priceListId: string;
  overview: CatalogOverview;
  editable: boolean;
}

/** Items × services grid of prices. Empty cell = not offered on this list. Key by priceListId to reset edits. */
export function PriceMatrix({ priceListId, overview, editable }: Props) {
  const f = useFormat();
  const matrix = usePriceMatrix(priceListId);
  const upsert = useUpsertPrices();
  const [dirty, setDirty] = useState<Record<string, string>>({});

  const original = useMemo(() => {
    const map = new Map<string, { price: string; isActive: boolean }>();
    for (const p of matrix.data?.prices ?? []) map.set(key(p.serviceCategoryId, p.serviceItemId), p);
    return map;
  }, [matrix.data]);

  const categories = overview.categories;
  const items = overview.items;

  const changes = useMemo(() => {
    const out: Array<{ serviceCategoryId: string; serviceItemId: string; price: string; isActive: boolean }> = [];
    const invalid: string[] = [];
    for (const [k, raw] of Object.entries(dirty)) {
      const [serviceCategoryId, serviceItemId] = k.split(':') as [string, string];
      const value = raw.trim();
      const orig = original.get(k);
      if (value === '') {
        if (orig?.isActive) out.push({ serviceCategoryId, serviceItemId, price: orig.price, isActive: false });
        continue;
      }
      if (!MONEY_RE.test(value)) {
        invalid.push(k);
        continue;
      }
      if (orig?.isActive && Number(orig.price) === Number(value)) continue;
      out.push({ serviceCategoryId, serviceItemId, price: value, isActive: true });
    }
    return { out, invalid };
  }, [dirty, original]);

  if (matrix.isLoading) {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (matrix.error) return <ErrorState message={errorMessage(matrix.error)} onRetry={() => void matrix.refetch()} />;
  if (!categories.length || !items.length) {
    return <EmptyState title="Add services and items first" description="Prices are set for each item × service combination." />;
  }

  const save = async () => {
    if (changes.invalid.length) {
      toast.error('Some prices are not valid amounts. Use numbers with up to 2 decimals.');
      return;
    }
    if (!changes.out.length) {
      setDirty({});
      return;
    }
    try {
      await upsert.mutateAsync({ id: priceListId, input: { items: changes.out } });
      setDirty({});
      toast.success(`Saved ${changes.out.length} price${changes.out.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't save these prices. Please try again."));
    }
  };

  const pending = Object.keys(dirty).length;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-44 border-b bg-slate-50 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Item
              </th>
              {categories.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    'min-w-28 border-b bg-slate-50 px-3 py-2 text-right text-xs font-medium text-muted-foreground',
                    !c.isActive && 'opacity-50',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: c.color ?? '#94a3b8' }} />
                    {c.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={cn(!item.isActive && 'opacity-50')}>
                <td className="sticky left-0 z-10 border-b bg-card px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <GarmentIcon name={item.name} icon={item.icon} className="size-8" />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{UNIT_TYPE_LABEL[item.unitType]}</p>
                    </div>
                  </div>
                </td>
                {categories.map((c) => {
                  const k = key(c.id, item.id);
                  const orig = original.get(k);
                  const value = dirty[k] ?? (orig?.isActive ? orig.price : '');
                  const isDirty = k in dirty;
                  const isInvalid = changes.invalid.includes(k);
                  return (
                    <td key={c.id} className="border-b px-2 py-1.5 text-right">
                      {editable ? (
                        <input
                          inputMode="decimal"
                          aria-label={`${item.name} — ${c.name} price`}
                          value={value}
                          placeholder="—"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDirty((d) => {
                              const next = { ...d };
                              const origValue = orig?.isActive ? orig.price : '';
                              if (v === origValue) delete next[k];
                              else next[k] = v;
                              return next;
                            });
                          }}
                          className={cn(
                            'tabular h-8 w-24 rounded-md border border-transparent bg-transparent px-2 text-right outline-none hover:border-input focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/25 placeholder:text-slate-300',
                            isDirty && 'border-amber-300 bg-amber-50',
                            isInvalid && 'border-destructive bg-rose-50',
                          )}
                        />
                      ) : (
                        <span className={cn('tabular', !value && 'text-slate-300')}>{value ? f.money(value) : '—'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && pending > 0 && (
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-card/95 px-4 py-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {pending} unsaved change{pending === 1 ? '' : 's'}
            {changes.invalid.length > 0 && <span className="text-destructive"> · {changes.invalid.length} invalid</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDirty({})}>
              <Undo2 />
              Discard
            </Button>
            <Button size="sm" onClick={() => void save()} loading={upsert.isPending}>
              <Save />
              Save {pending} change{pending === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
