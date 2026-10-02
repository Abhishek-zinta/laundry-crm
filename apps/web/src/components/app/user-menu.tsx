'use client';

import { ROLE_LABEL } from '@rinseops/shared';
import { KeyRound, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/session';
import { initials } from '@/lib/utils';
import { ChangePasswordDialog } from './change-password-dialog';

export function UserMenu() {
  const { me, logout, can } = useSession();
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-300 focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Account menu"
          >
            {initials(me.user.name)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{me.user.name}</p>
            <p className="truncate text-xs">{me.user.email}</p>
            <p className="mt-0.5 text-xs">
              {ROLE_LABEL[me.user.role]} · {me.tenant.name}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {can('settings.manage') && (
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings />
                Business settings
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}
