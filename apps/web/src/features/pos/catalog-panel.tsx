'use client';

import { UNIT_TYPE_SHORT, type PosCatalog } from '@rinseops/shared';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { GarmentIcon } from '@/components/shared/garment-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/lib/format';
import { isTyping } from '@/lib/hotkeys';
import { cn } from '@/lib/utils';

interface CatalogPanelProps {
  catalog: PosCatalog | undefined;
  loading: boolean;
  /** Quantity already in the cart per "categoryId:itemId". */
  inCart: Map<string, number>;
  onAdd: (categoryId: string, item: PosCatalog['categories'][number]['items'][number]) => void;
}

/** Service tabs and illustrated item tiles — one tap adds an item to the cart. */
export function CatalogPanel({ catalog, loading, inCart, onAdd }: CatalogPanelProps) {
  const f = useFormat();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const categories = useMemo(() => catalog?.categories ?? [], [catalog]);
  const current = categories.find((c) => c.id === selected) ?? categories[0];

  // 1–9 jump between services (ignored while typing or with modifier keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const n = Number(e.key);
      const target = Number.isInteger(n) && n >= 1 ? categories[n - 1] : undefined;
      if (!target) return;
      e.preventDefault();
      setSelected(target.id);
      setFilter('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [categories]);

  const term = filter.trim().toLowerCase();
  const tiles = term
    ? categories.flatMap((c) => c.items.filter((i) => i.name.toLowerCase().includes(term)).map((i) => ({ c, i })))
    : (current?.items ?? []).map((i) => ({ c: current!, i }));

  if (loading && !catalog) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }
  if (!categories.length) {
    return (
      <EmptyState title="No priced services yet" description="Add services and prices under Services & Pricing to start taking orders." />
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-2 border-b sm:flex-row sm:items-end">
        <nav aria-label="Services" className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {categories.map((c, idx) => {
            const active = !term && c.id === current?.id;
            const count = c.items.reduce((n, i) => n + (inCart.has(`${c.id}:${i.serviceItemId}`) ? 1 : 0), 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelected(c.id);
                  setFilter('');
                }}
                title={`${c.name} (${idx + 1})`}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 border-b-[3px] px-3 pt-2 pb-2.5 text-[15px] font-medium whitespace-nowrap transition-colors',
                  active ? 'text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                style={active ? { borderBottomColor: c.color ?? 'var(--primary)' } : undefined}
                aria-current={active ? 'true' : undefined}
              >
                {c.name}
                {count > 0 && (
                  <span className="grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="relative mb-2 sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search all items…"
            className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
            aria-label="Search items"
          />
        </div>
      </div>

      {tiles.length === 0 ? (
        <EmptyState compact title="No items found" description="Try another service or search term." />
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
          {tiles.map(({ c, i }) => {
            const count = inCart.get(`${c.id}:${i.serviceItemId}`);
            return (
              <button
                key={`${c.id}:${i.serviceItemId}`}
                type="button"
                onClick={() => onAdd(c.id, i)}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2 pt-3 pb-2 text-center shadow-xs transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-sm active:translate-y-0 active:scale-[0.98]',
                  count && 'border-primary/70 bg-primary-soft/40 ring-1 ring-primary/20',
                )}
              >
                <GarmentIcon name={i.name} icon={i.icon} className="size-12 transition-transform group-hover:scale-105 sm:size-14" />
                <span className="line-clamp-1 text-[13px] leading-tight font-medium">{i.name}</span>
                <span className="tabular text-xs text-muted-foreground">
                  {f.money(i.price)}
                  <span className="text-[11px]">/{UNIT_TYPE_SHORT[i.unitType]}</span>
                </span>
                {term && <span className="line-clamp-1 text-[10px] text-muted-foreground">{c.name}</span>}
                {count ? (
                  <span className="tabular absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
