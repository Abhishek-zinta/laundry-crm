'use client';

import { ROLE_LABEL } from '@rinseops/shared';
import { LogOut, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ALL_STORES, useSession } from '@/lib/session';
import { cn, initials } from '@/lib/utils';
import { Logo } from './logo';
import { activeHref, visibleNav } from './nav';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useSession();
  const pathname = usePathname();
  const items = visibleNav(can);
  const active = activeHref(pathname, items);

  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
              isActive && 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
            )}
          >
            <item.icon
              className={cn(
                'size-4 shrink-0 text-slate-400 group-hover:text-slate-600',
                isActive && 'text-primary group-hover:text-primary',
              )}
            />
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <kbd className="ml-auto hidden rounded border bg-card px-1.5 font-mono text-[10px] text-muted-foreground lg:inline">
                {item.shortcut}
              </kbd>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarFooter() {
  const { me, storeId, logout } = useSession();
  const store = storeId === ALL_STORES ? null : me.stores.find((s) => s.id === storeId);
  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-muted-foreground">
        <Store className="size-3.5 shrink-0" />
        <span className="truncate">{store ? store.name : 'All stores'}</span>
      </div>
      <div className="flex items-center gap-2.5 px-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {initials(me.user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{me.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[me.user.role]}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { me } = useSession();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>
      <p className="mb-2 truncate px-4 text-xs font-medium text-muted-foreground">{me.tenant.name}</p>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <SidebarNav />
      </div>
      <SidebarFooter />
    </aside>
  );
}
