'use client';

import { Check, ChevronsUpDown, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ALL_STORES, useSession } from '@/lib/session';

export function StoreSwitcher() {
  const { me, storeId, setStoreId } = useSession();
  const stores = me.stores;
  const current = stores.find((s) => s.id === storeId);
  if (stores.length <= 1) {
    return (
      <div className="hidden items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground md:flex">
        <Store className="size-4" />
        <span className="max-w-40 truncate">{stores[0]?.name ?? 'No store'}</span>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-48 gap-1.5" aria-label={`Store: ${current?.name ?? 'All stores'}`}>
          <Store className="text-muted-foreground" />
          <span className="hidden truncate sm:inline">{current?.name ?? 'All stores'}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch store</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setStoreId(ALL_STORES)}>
          <span className="flex-1">All stores</span>
          {storeId === ALL_STORES && <Check className="!text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {stores.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => setStoreId(s.id)}>
            <span className="flex-1 truncate">{s.name}</span>
            {storeId === s.id && <Check className="!text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
