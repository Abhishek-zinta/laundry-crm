'use client';

import { customerDisplayName, Permission, type OrderListItem, type RackBoard } from '@rinseops/shared';
import { Boxes, MoreHorizontal, PackageOpen, Plus, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { MoneyDisplay } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useOrders, useRackBoard, useRemoveFromRack } from '../orders/api';
import { AssignRackDialog } from '../orders/assign-rack-dialog';
import { useUpdateRack } from './api';
import { AddSlotDialog, CreateRackDialog, EditSlotDialog } from './rack-dialogs';

type Slot = RackBoard['racks'][number]['slots'][number];
type SlotOrder = Slot['orders'][number];

export function RacksScreen() {
  const { me, can, storeFilter, activeStoreId } = useSession();
  const [pickedStore, setPickedStore] = useState<string | null>(null);
  const storeId = pickedStore ?? storeFilter ?? activeStoreId;
  const store = me.stores.find((s) => s.id === storeId);
  const board = useRackBoard(storeId);
  const waiting = useOrders({ status: 'READY', storeId, pageSize: 100, sort: 'dueDate', dir: 'asc' });
  const unracked = (waiting.data?.items ?? []).filter((o) => !o.rack);

  const [assignFor, setAssignFor] = useState<
    (Pick<OrderListItem, 'id' | 'orderNumber' | 'rack'> & { store: { id: string; name: string } }) | null
  >(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addSlotFor, setAddSlotFor] = useState<{ id: string; name: string; code: string; nextSlot: string } | null>(null);
  const [editSlot, setEditSlot] = useState<{ id: string; code: string; capacity: number; isActive: boolean; used: number } | null>(null);
  const updateRack = useUpdateRack();
  const manage = can(Permission.RACKS_MANAGE);
  const canAssign = can(Permission.RACKS_ASSIGN);

  const nextCode = useMemo(() => {
    const used = new Set(board.data?.racks.map((r) => r.code));
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !used.has(c)) ?? 'Z';
  }, [board.data]);

  const stats = board.data?.stats;

  return (
    <>
      <PageHeader
        title="Racks"
        description={store ? `Where ready orders are waiting at ${store.name}` : 'Where ready orders are waiting'}
        actions={
          <>
            {me.stores.length > 1 && (
              <NativeSelect className="w-auto" value={storeId} onChange={(e) => setPickedStore(e.target.value)} aria-label="Store">
                {me.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {manage && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                New rack
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Slots in use" value={stats ? `${stats.occupied} / ${stats.slots}` : '—'} icon={Boxes} loading={board.isLoading} />
        <StatCard
          label="Capacity used"
          value={stats && stats.capacity ? `${Math.round((stats.used / stats.capacity) * 100)}%` : '—'}
          hint={stats ? `${stats.used} of ${stats.capacity} order spaces` : undefined}
          loading={board.isLoading}
        />
        <StatCard
          label="Ready, not racked"
          value={unracked.length}
          tone={unracked.length ? 'warning' : 'default'}
          icon={PackageOpen}
          loading={waiting.isLoading}
        />
        <StatCard label="Ready orders" value={waiting.data?.total ?? '—'} href="/orders?quick=ready" loading={waiting.isLoading} />
      </div>

      {unracked.length > 0 && canAssign && (
        <Card className="mb-4 border-amber-200">
          <CardHeader className="bg-amber-50/60">
            <CardTitle>Waiting for a rack slot</CardTitle>
            <span className="text-xs text-muted-foreground">{unracked.length} ready</span>
          </CardHeader>
          <ul className="divide-y">
            {unracked.slice(0, 8).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {customerDisplayName(o.customer)} · {o.totalPieces} pcs
                </span>
                <Button size="xs" onClick={() => setAssignFor(o)}>
                  Assign slot
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {board.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : board.error ? (
        <ErrorState message={errorMessage(board.error)} onRetry={() => void board.refetch()} />
      ) : !board.data?.racks.length ? (
        <EmptyState
          icon={Boxes}
          title="No racks yet"
          description="Create racks and slots so ready orders can be found instantly when customers arrive."
          action={manage ? <Button onClick={() => setCreateOpen(true)}>Create first rack</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {board.data.racks.map((rack) => {
            const used = rack.slots.reduce((a, s) => a + s.orders.length, 0);
            const lastNumber = rack.slots.reduce((max, s) => Math.max(max, Number(s.code.replace(/\D/g, '')) || 0), 0);
            return (
              <Card key={rack.id} className={cn(!rack.isActive && 'opacity-60')}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-md bg-primary-soft font-mono text-sm font-bold text-primary">
                      {rack.code}
                    </span>
                    <CardTitle>{rack.name}</CardTitle>
                    {!rack.isActive && <Badge tone="outline">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {used} order{used === 1 ? '' : 's'} · {rack.slots.length} slots
                    </span>
                    {manage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`${rack.name} options`}>
                            <Settings2 />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onSelect={() =>
                              setAddSlotFor({
                                id: rack.id,
                                name: rack.name,
                                code: rack.code,
                                nextSlot: `${rack.code}${String(lastNumber + 1).padStart(2, '0')}`,
                              })
                            }
                          >
                            <Plus />
                            Add slot
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              updateRack.mutate(
                                { id: rack.id, isActive: !rack.isActive },
                                {
                                  onSuccess: () => toast.success(rack.isActive ? `${rack.name} deactivated` : `${rack.name} activated`),
                                  onError: (err) => toast.error(errorMessage(err)),
                                },
                              )
                            }
                          >
                            {rack.isActive ? 'Deactivate rack' : 'Activate rack'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-4 2xl:grid-cols-6">
                  {rack.slots.map((slot) => (
                    <SlotCell
                      key={slot.id}
                      slot={slot}
                      canAssign={canAssign}
                      manage={manage}
                      onMove={(o) =>
                        setAssignFor({
                          id: o.id,
                          orderNumber: o.orderNumber,
                          store: { id: storeId, name: store?.name ?? '' },
                          rack: { slotId: slot.id, slotCode: slot.code, rackId: rack.id, rackName: rack.name, rackCode: rack.code },
                        })
                      }
                      onEdit={() =>
                        setEditSlot({
                          id: slot.id,
                          code: slot.code,
                          capacity: slot.capacity,
                          isActive: slot.isActive,
                          used: slot.orders.length,
                        })
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {assignFor && <AssignRackDialog order={assignFor} open onOpenChange={(o) => !o && setAssignFor(null)} />}
      <CreateRackDialog open={createOpen} onOpenChange={setCreateOpen} storeId={storeId} nextCode={nextCode} />
      <AddSlotDialog rack={addSlotFor} onOpenChange={(o) => !o && setAddSlotFor(null)} />
      <EditSlotDialog slot={editSlot} onOpenChange={(o) => !o && setEditSlot(null)} />
    </>
  );
}

function SlotCell({
  slot,
  canAssign,
  manage,
  onMove,
  onEdit,
}: {
  slot: Slot;
  canAssign: boolean;
  manage: boolean;
  onMove: (o: SlotOrder) => void;
  onEdit: () => void;
}) {
  const f = useFormat();
  const occupied = slot.orders.length > 0;
  const full = slot.orders.length >= slot.capacity;
  return (
    <div
      className={cn(
        'group relative flex min-h-[86px] flex-col rounded-lg border p-2 text-xs',
        !slot.isActive && 'border-dashed bg-slate-50 text-muted-foreground',
        slot.isActive && !occupied && 'border-dashed bg-card',
        occupied && (full ? 'border-teal-300 bg-teal-50' : 'border-teal-200 bg-teal-50/50'),
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] font-bold">{slot.code}</span>
        <span className="flex items-center gap-1">
          {slot.capacity > 1 && (
            <span className="tabular text-[10px] text-muted-foreground">
              {slot.orders.length}/{slot.capacity}
            </span>
          )}
          {(manage || (canAssign && occupied)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-white hover:text-foreground"
                  aria-label={`Slot ${slot.code} options`}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {slot.orders.map((o) => (
                  <SlotOrderActions key={o.id} order={o} canAssign={canAssign} onMove={() => onMove(o)} />
                ))}
                {manage && (
                  <>
                    {slot.orders.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onSelect={onEdit}>
                      <Settings2 />
                      Slot settings
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>
      {!slot.isActive ? (
        <span className="mt-auto">Not in use</span>
      ) : occupied ? (
        <div className="mt-1 grid gap-1">
          {slot.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="block rounded bg-white/80 px-1.5 py-1 hover:bg-white">
              <span className="block truncate font-mono font-semibold">{o.orderNumber.split('-').pop()}</span>
              <span className="block truncate text-muted-foreground">{o.customerName}</span>
              {Number(o.balanceDue) > 0 ? (
                <MoneyDisplay value={o.balanceDue} emphasizeDue className="text-[11px]" />
              ) : (
                <span className="text-[11px] text-emerald-700">Paid · {o.totalPieces} pcs</span>
              )}
              <span className="sr-only">ready since {f.dateTime(o.assignedAt)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <span className="mt-auto text-muted-foreground">Free</span>
      )}
    </div>
  );
}

function SlotOrderActions({ order, canAssign, onMove }: { order: SlotOrder; canAssign: boolean; onMove: () => void }) {
  const remove = useRemoveFromRack(order.id);
  return (
    <>
      <DropdownMenuItem asChild>
        <Link href={`/orders/${order.id}`}>Open {order.orderNumber}</Link>
      </DropdownMenuItem>
      {canAssign && (
        <>
          <DropdownMenuItem onSelect={onMove}>Move {order.orderNumber.split('-').pop()} to another slot</DropdownMenuItem>
          <DropdownMenuItem
            destructive
            onSelect={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success(`${order.orderNumber} removed from rack`),
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Remove {order.orderNumber.split('-').pop()} from rack
          </DropdownMenuItem>
        </>
      )}
    </>
  );
}
