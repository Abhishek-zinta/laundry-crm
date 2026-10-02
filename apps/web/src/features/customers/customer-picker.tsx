'use client';

import { customerDisplayName, phoneDigits, type CustomerListItem } from '@rinseops/shared';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MoneyDisplay } from '@/components/shared/money';
import { useDebouncedValue } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { useCustomers } from './api';

interface CustomerPickerProps {
  onSelect: (customer: CustomerListItem) => void;
  onCreate: (prefill: { phone?: string; firstName?: string }) => void;
  autoFocus?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Phone-first customer lookup for the counter. Type digits or a name,
 * use ↑/↓ and Enter to pick, or create a new customer in one step.
 */
export function CustomerPicker({ onSelect, onCreate, autoFocus, className, placeholder }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebouncedValue(query.trim(), 150);
  const enabled = q.length >= 2;
  const { data, isFetching } = useCustomers({ q: enabled ? q : undefined, pageSize: 6, sort: 'recent' });
  const results = enabled ? (data?.items ?? []) : [];
  const looksLikePhone = phoneDigits(query).length >= 6 && /^[+\d\s\-()]+$/.test(query.trim());
  const showCreate = enabled && !isFetching;
  const options = results.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const create = () => onCreate(looksLikePhone ? { phone: query.trim() } : { firstName: query.trim().split(' ')[0] });

  const choose = (raw: number) => {
    const i = Math.min(raw, Math.max(options - 1, 0));
    if (i < results.length) onSelect(results[i]!);
    else if (showCreate) create();
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, Math.max(options - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (options) choose(active);
            }
          }}
          inputMode="search"
          placeholder={placeholder ?? 'Customer phone or name…'}
          className="h-11 w-full rounded-lg border border-input bg-card pr-9 pl-9 text-[15px] shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          aria-label="Search customers"
          role="combobox"
          aria-expanded={enabled}
          aria-controls="customer-picker-list"
        />
        {isFetching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {enabled && (
        <ul id="customer-picker-list" role="listbox" className="mt-2 overflow-hidden rounded-lg border bg-card shadow-sm">
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', i === active && 'bg-primary-soft/70')}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {c.firstName[0]}
                  {c.lastName?.[0] ?? ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{customerDisplayName(c)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.phone} · {c.orderCount} orders
                  </span>
                </span>
                {Number(c.balance) > 0 && (
                  <span className="text-right text-xs">
                    <MoneyDisplay value={c.balance} emphasizeDue />
                    <span className="block text-muted-foreground">due</span>
                  </span>
                )}
              </button>
            </li>
          ))}
          {showCreate && (
            <li role="option" aria-selected={active === results.length}>
              <button
                type="button"
                onMouseEnter={() => setActive(results.length)}
                onClick={create}
                className={cn(
                  'flex w-full items-center gap-3 border-t px-3 py-2.5 text-left text-sm text-primary',
                  active === results.length && 'bg-primary-soft/70',
                )}
              >
                <UserPlus className="size-4" />
                {results.length ? 'New customer' : `No match — create customer${looksLikePhone ? ` with ${query.trim()}` : ''}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
