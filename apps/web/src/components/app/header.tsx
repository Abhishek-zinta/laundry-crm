'use client';

import { Permission } from '@rinseops/shared';
import { Bell, Menu, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useHotkey } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { useCommandPalette } from './command-palette';
import { Logo } from './logo';
import { SidebarFooter, SidebarNav } from './sidebar';
import { StoreSwitcher } from './store-switcher';
import { UserMenu } from './user-menu';

const noopSubscribe = () => () => {};

export function Header() {
  const { can } = useSession();
  const palette = useCommandPalette();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  // Close the mobile menu after navigation.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }
  useHotkey('n', () => router.push('/orders/new'), { enabled: can(Permission.ORDERS_CREATE) });

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
        <Menu />
      </Button>
      <Link href="/" className="lg:hidden" aria-label="Home">
        <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
      </Link>

      <button
        type="button"
        onClick={palette.open}
        className="ml-1 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-slate-50/80 px-3 text-sm text-muted-foreground transition-colors hover:bg-slate-100 sm:max-w-md lg:ml-0"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search phone, order #, tag…</span>
        <kbd className="ml-auto hidden rounded border bg-card px-1.5 font-mono text-[10px] sm:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <StoreSwitcher />
        {can(Permission.ORDERS_CREATE) && (
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/orders/new">
              <Plus />
              New Order
            </Link>
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-sm font-medium">Notifications</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re all caught up. Alerts for overdue orders and new pickup requests will appear here.
            </p>
          </PopoverContent>
        </Popover>
        <UserMenu />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center px-4">
            <Logo />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </div>
          <SidebarFooter />
        </SheetContent>
      </Sheet>
    </header>
  );
}
