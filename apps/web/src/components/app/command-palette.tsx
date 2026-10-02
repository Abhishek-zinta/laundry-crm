'use client';

import { customerDisplayName, type SearchResult } from '@rinseops/shared';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Boxes, Loader2, Search, Shirt, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { MoneyDisplay } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api-client';
import { useHotkey } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { useDebouncedValue } from '@/lib/use-debounce';
import { toQuery } from '@/lib/utils';
import { visibleNav } from './nav';

const PaletteContext = createContext<{ open: () => void } | null>(null);
export const useCommandPalette = () => useContext(PaletteContext)!;

const groupHeading =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground';
const itemClass =
  'mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm aria-selected:bg-slate-100 data-[selected=true]:bg-slate-100';

/** Global Cmd/Ctrl+K search across customers, orders and garment tags. */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { can } = useSession();
  const q = useDebouncedValue(query.trim(), 150);

  useHotkey('k', () => setOpen((o) => !o), { mod: true, allowInInputs: true });
  useHotkey('/', () => setOpen(true));

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => apiGet<SearchResult>(`/search${toQuery({ q, limit: 8 })}`, signal),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  });

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  const results = q.length >= 2 ? data : undefined;
  const nothing = results && !results.customers.length && !results.orders.length && !results.garments.length;

  return (
    <PaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
          <DialogPrimitive.Content className="fixed top-[10vh] left-1/2 z-50 w-[94vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-2xl outline-none">
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <Command shouldFilter={false} loop className="flex max-h-[70vh] flex-col">
              <div className="flex items-center gap-2 border-b px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search phone, name, order # or tag…"
                  className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
                {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
              </div>
              <Command.List className="min-h-0 flex-1 overflow-y-auto pb-2">
                {q.length < 2 && (
                  <Command.Group heading="Go to" className={groupHeading}>
                    {visibleNav(can).map((item) => (
                      <Command.Item key={item.href} value={item.href} onSelect={() => go(item.href)} className={itemClass}>
                        <item.icon className="size-4 text-muted-foreground" />
                        {item.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {nothing && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No matches for <span className="font-medium text-foreground">“{q}”</span>
                  </div>
                )}
                {results && results.orders.length > 0 && (
                  <Command.Group heading="Orders" className={groupHeading}>
                    {results.orders.map((o) => (
                      <Command.Item key={o.id} value={`order-${o.id}`} onSelect={() => go(`/orders/${o.id}`)} className={itemClass}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-medium">{o.orderNumber}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {customerDisplayName(o.customer)} · {o.customer.phone} · {o.totalPieces} pcs
                          </p>
                        </div>
                        {o.rack && (
                          <Badge tone="teal" className="text-[13px]">
                            <Boxes />
                            {o.rack.rackName} → {o.rack.slotCode}
                          </Badge>
                        )}
                        <div className="text-right text-xs">
                          <MoneyDisplay value={o.balanceDue} emphasizeDue muteZero />
                          <p className="text-muted-foreground">due</p>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results && results.customers.length > 0 && (
                  <Command.Group heading="Customers" className={groupHeading}>
                    {results.customers.map((c) => (
                      <Command.Item key={c.id} value={`customer-${c.id}`} onSelect={() => go(`/customers/${c.id}`)} className={itemClass}>
                        <User className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{customerDisplayName(c)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.phone} · {c.totalOrders} orders
                          </p>
                        </div>
                        <MoneyDisplay value={c.outstanding} emphasizeDue muteZero className="text-xs" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results && results.garments.length > 0 && (
                  <Command.Group heading="Garments" className={groupHeading}>
                    {results.garments.map((g) => (
                      <Command.Item
                        key={g.id}
                        value={`garment-${g.id}`}
                        onSelect={() => go(`/orders/${g.order.id}?tab=garments`)}
                        className={itemClass}
                      >
                        <Shirt className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">
                            <span className="font-mono text-[13px] font-medium">{g.tagCode}</span>{' '}
                            <span className="text-muted-foreground">{g.description}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {g.order.orderNumber} · {customerDisplayName(g.order.customer)}
                          </p>
                        </div>
                        <StatusBadge status={g.status} />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
              <div className="hidden items-center gap-4 border-t bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground sm:flex">
                <span>
                  <kbd className="font-mono">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="font-mono">↵</kbd> open
                </span>
                <span className="ml-auto">Tip: type a phone number, RO-2026-…, or a GAR- tag</span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </PaletteContext.Provider>
  );
}
