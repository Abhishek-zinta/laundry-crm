'use client';

import { ASSIGNABLE_ROLES, Permission, ROLE_LABEL, type Role, type StaffDto } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { initials } from '@/lib/utils';
import { useStaff, useUpdateStaff } from './api';
import { CreateStaffDialog, EditStaffDialog } from './staff-dialogs';

const ROLE_TONE: Record<Role, BadgeTone> = {
  OWNER: 'teal',
  MANAGER: 'violet',
  COUNTER_STAFF: 'blue',
  PROCESSING_STAFF: 'amber',
  DRIVER: 'neutral',
};

export function StaffScreen() {
  const { me, can } = useSession();
  const f = useFormat();
  const staff = useStaff();
  const update = useUpdateStaff();
  const canManage = can(Permission.STAFF_MANAGE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [toggling, setToggling] = useState<StaffDto | null>(null);

  const manageable = (s: StaffDto) => s.id !== me.user.id && ASSIGNABLE_ROLES[me.user.role].includes(s.role);
  const editableRow = (s: StaffDto) => canManage && (s.id === me.user.id || manageable(s));

  const columns: ColumnDef<StaffDto>[] = [
    {
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {initials(row.original.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.name}
              {row.original.id === me.user.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Phone',
      meta: { hideOnMobile: true },
      cell: ({ row }) => row.original.phone ?? <span className="text-muted-foreground">—</span>,
    },
    { header: 'Role', cell: ({ row }) => <Badge tone={ROLE_TONE[row.original.role]}>{ROLE_LABEL[row.original.role]}</Badge> },
    {
      header: 'Stores',
      meta: { hideOnMobile: true },
      cell: ({ row }) =>
        row.original.role === 'OWNER' ? (
          <span className="text-muted-foreground">All stores</span>
        ) : row.original.stores.length ? (
          <span className="text-sm">{row.original.stores.map((s) => s.name).join(', ')}</span>
        ) : (
          <span className="text-amber-700">No store assigned</span>
        ),
    },
    {
      header: 'Status',
      cell: ({ row }) => (row.original.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="neutral">Inactive</Badge>),
    },
    {
      header: 'Last login',
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span className="text-muted-foreground" title={row.original.lastLoginAt ? f.dateTime(row.original.lastLoginAt) : undefined}>
          {row.original.lastLoginAt ? f.relative(row.original.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) =>
        editableRow(row.original) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${row.original.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              {manageable(row.original) &&
                (row.original.status === 'ACTIVE' ? (
                  <DropdownMenuItem destructive onSelect={() => setToggling(row.original)}>
                    <UserX /> Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setToggling(row.original)}>
                    <UserCheck /> Activate
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  const confirmToggle = async () => {
    if (!toggling) return;
    const next = toggling.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await update.mutateAsync({ id: toggling.id, input: { status: next } });
      toast.success(next === 'ACTIVE' ? `${toggling.name} can sign in again` : `${toggling.name} has been deactivated`);
      setToggling(null);
    } catch (err) {
      toast.error(errorMessage(err, "We couldn't update this staff member."));
    }
  };

  const active = staff.data?.filter((s) => s.status === 'ACTIVE').length ?? 0;

  return (
    <>
      <PageHeader
        title="Staff"
        description={staff.data ? `${active} active of ${staff.data.length} team members` : 'Your team and what they can access.'}
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Add staff
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={staff.data}
        loading={staff.isLoading}
        error={staff.error}
        onRetry={() => void staff.refetch()}
        getRowId={(r) => r.id}
        empty={<EmptyState icon={Users} title="No staff yet" description="Add counter, processing and driver accounts for your team." />}
      />
      <CreateStaffDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditStaffDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} staff={editing} />
      <ConfirmationDialog
        open={Boolean(toggling)}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.status === 'ACTIVE' ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={
          toggling?.status === 'ACTIVE'
            ? 'They will be signed out immediately and won’t be able to sign in. Their history is kept.'
            : 'They will be able to sign in again with their existing password.'
        }
        confirmLabel={toggling?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        destructive={toggling?.status === 'ACTIVE'}
        loading={update.isPending}
        onConfirm={() => void confirmToggle()}
      />
    </>
  );
}
