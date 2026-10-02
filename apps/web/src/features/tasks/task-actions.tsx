'use client';

import { Permission, TASK_TYPE_LABEL, type TaskListItem, type TaskStatus } from '@rinseops/shared';
import { CalendarClock, MoreHorizontal, PlusCircle, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessage } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { useChangeTaskStatus } from './api';
import { AssignDriverDialog } from './assign-driver-dialog';
import { EditTaskDialog } from './edit-task-dialog';
import { canCreateOrderFromTask, NEEDS_REASON, STATUS_ACTION_LABEL, statusActions } from './status-actions';

const CLOSED: TaskStatus[] = ['PICKED_UP', 'DELIVERED', 'CANCELLED'];

export function TaskActions({ task, compact }: { task: TaskListItem; compact?: boolean }) {
  const { can } = useSession();
  const manage = can(Permission.TASKS_MANAGE);
  const canUpdate = can(Permission.TASKS_UPDATE_STATUS);
  const change = useChangeTaskStatus();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<TaskStatus | null>(null);

  const transitions = canUpdate ? statusActions(task) : [];
  const closed = CLOSED.includes(task.status);
  const assignable = manage && ['SCHEDULED', 'ASSIGNED', 'FAILED'].includes(task.status);
  const showCreateOrder = can(Permission.ORDERS_CREATE) && canCreateOrderFromTask(task);

  const run = (status: TaskStatus, note?: string) =>
    change.mutate(
      { id: task.id, status, note },
      {
        onSuccess: () => {
          setPending(null);
          toast.success(`${TASK_TYPE_LABEL[task.type]} updated`);
        },
        onError: (err) => toast.error(errorMessage(err, "We couldn't update this task.")),
      },
    );

  return (
    <div className="flex items-center justify-end gap-1.5" data-no-row-click>
      {showCreateOrder && (
        <Button asChild size={compact ? 'sm' : 'xs'} variant={task.status === 'PICKED_UP' ? 'default' : 'outline'}>
          <Link href={`/orders/new?customerId=${task.customerId}&taskId=${task.id}`}>
            <PlusCircle />
            Create order
          </Link>
        </Button>
      )}
      {(transitions.length > 0 || assignable || (manage && !closed)) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Task actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            {assignable && (
              <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
                <UserRound />
                {task.assignedDriverId ? 'Reassign driver' : 'Assign driver'}
              </DropdownMenuItem>
            )}
            {manage && !closed && (
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <CalendarClock />
                Reschedule / edit
              </DropdownMenuItem>
            )}
            {transitions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Update status</DropdownMenuLabel>
                {transitions.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    destructive={NEEDS_REASON.includes(s)}
                    disabled={s === 'SCHEDULED' && !manage}
                    onSelect={() => setPending(s)}
                  >
                    {STATUS_ACTION_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {assignOpen && <AssignDriverDialog task={task} open={assignOpen} onOpenChange={setAssignOpen} />}
      {editOpen && <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />}
      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${STATUS_ACTION_LABEL[pending]}?` : ''}
        description={`${TASK_TYPE_LABEL[task.type]} for ${task.customer.firstName} ${task.customer.lastName ?? ''} · ${task.timeSlot}`}
        confirmLabel={pending ? STATUS_ACTION_LABEL[pending] : 'Confirm'}
        destructive={pending ? NEEDS_REASON.includes(pending) : false}
        loading={change.isPending}
        reason={
          pending && NEEDS_REASON.includes(pending)
            ? { label: 'Reason', placeholder: pending === 'FAILED' ? 'e.g. Customer not home' : 'e.g. Customer cancelled', required: true }
            : undefined
        }
        onConfirm={(note) => {
          if (pending) run(pending, note);
        }}
      />
    </div>
  );
}
