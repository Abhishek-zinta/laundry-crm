'use client';

import { customerDisplayName, ORDER_STATUS_LABEL, Permission, type GarmentListItem, type OrderStatus } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Boxes, Camera, CheckCircle2, ScanLine, Search, Shirt, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { ORDER_STATUS_DOT, StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useDebouncedValue } from '@/lib/use-debounce';
import { cn } from '@/lib/utils';
import { useBulkGarmentStatus, useGarmentByTag, useGarments, useGarmentStatus } from './api';
import { CameraScanDialog, cameraScanSupported } from './camera-scan-dialog';
import { GarmentEditDialog } from './garment-edit-dialog';
import { IssueBadges } from './issue-badges';

const WORK_STATUSES: OrderStatus[] = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY'];
type ScanMode = 'lookup' | OrderStatus;

interface ScanLogEntry {
  id: number;
  tag: string;
  ok: boolean;
  message: string;
}

export function GarmentsScreen() {
  const { can, storeFilter } = useSession();
  const f = useFormat();
  const canUpdate = can(Permission.GARMENTS_UPDATE);
  const [state, setState] = useUrlState({
    status: 'PROCESSING' as string | undefined,
    q: undefined as string | undefined,
    issues: undefined as string | undefined,
    page: '1',
  });
  const [search, setSearch] = useState(state.q ?? '');
  const debounced = useDebouncedValue(search, 250);
  useEffect(() => {
    if ((debounced || undefined) !== state.q) setState({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const page = Number(state.page) || 1;
  const list = useGarments({
    status: state.status === 'ALL' ? undefined : state.status,
    q: state.q,
    hasIssues: state.issues,
    storeId: storeFilter,
    page,
    pageSize: 30,
  });

  const [edit, setEdit] = useState<GarmentListItem | null>(null);
  const statusMutation = useGarmentStatus();

  const columns = useMemo<ColumnDef<GarmentListItem>[]>(
    () => [
      {
        id: 'tag',
        header: 'Tag',
        cell: ({ row }) => <span className="font-mono text-[13px] font-semibold">{row.original.tagCode}</span>,
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="max-w-[220px]">
            <p className="truncate font-medium">{row.original.orderLine.itemName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.orderLine.categoryName}
              {row.original.color && ` · ${row.original.color}`}
            </p>
          </div>
        ),
      },
      {
        id: 'order',
        header: 'Order',
        cell: ({ row }) => (
          <Link href={`/orders/${row.original.order.id}?tab=garments`} className="font-mono text-[13px] hover:text-primary hover:underline">
            {row.original.order.orderNumber}
          </Link>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        meta: { hideOnMobile: true },
        cell: ({ row }) => customerDisplayName(row.original.order.customer),
      },
      {
        id: 'due',
        header: 'Due',
        meta: { hideOnMobile: true },
        cell: ({ row }) => {
          const late = new Date(row.original.order.dueDate) < new Date() && row.original.status !== 'READY';
          return <span className={cn(late && 'font-medium text-rose-600')}>{f.dateTime(row.original.order.dueDate)}</span>;
        },
      },
      {
        id: 'issues',
        header: 'Condition',
        meta: { hideOnMobile: true, className: 'whitespace-normal' },
        cell: ({ row }) =>
          row.original.issues.length ? <IssueBadges issues={row.original.issues} /> : <span className="text-muted-foreground">—</span>,
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        header: '',
        meta: { align: 'right' },
        cell: ({ row }) => {
          const g = row.original;
          const editable = ['RECEIVED', 'PROCESSING', 'QUALITY_CHECK'].includes(g.order.status);
          if (!canUpdate) return null;
          return (
            <div className="flex justify-end gap-1" data-no-row-click>
              {editable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="xs">
                      Move to…
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {WORK_STATUSES.filter((s) => s !== g.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() =>
                          statusMutation.mutate(
                            { id: g.id, status: s },
                            {
                              onSuccess: () => toast.success(`${g.tagCode} → ${ORDER_STATUS_LABEL[s]}`),
                              onError: (err) => toast.error(errorMessage(err, "We couldn't update this garment.")),
                            },
                          )
                        }
                      >
                        <span className={cn('size-2 rounded-full', ORDER_STATUS_DOT[s])} />
                        {ORDER_STATUS_LABEL[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" size="xs" onClick={() => setEdit(g)}>
                Details
              </Button>
            </div>
          );
        },
      },
    ],
    [f, canUpdate, statusMutation],
  );

  const counts = list.data?.statusCounts ?? {};
  const tabs: Array<{ value: string; label: string; count?: number }> = [
    ...WORK_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s], count: counts[s] ?? 0 })),
    { value: 'ALL', label: 'All' },
  ];

  return (
    <>
      <PageHeader title="Garments" description="Track every tagged item through cleaning. Scan or type a tag to find or update it." />

      <ScanPanel canUpdate={canUpdate} />

      <div className="mt-5 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const active = (state.status ?? 'ALL') === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setState({ status: t.value })}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
                  active ? 'border-slate-900 bg-slate-900 text-white' : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {t.value !== 'ALL' && <span className={cn('size-1.5 rounded-full', ORDER_STATUS_DOT[t.value as OrderStatus])} />}
                {t.label}
                {t.count !== undefined && (
                  <span className={cn('tabular text-xs', active ? 'text-white/70' : 'text-muted-foreground')}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tag, order # or item" className="pl-9" />
        </div>
        <Button
          variant={state.issues === 'true' ? 'soft' : 'outline'}
          onClick={() => setState({ issues: state.issues === 'true' ? undefined : 'true' })}
        >
          <AlertTriangle />
          With issues
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={list.data?.items}
        loading={list.isLoading || list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        rowHref={(g) => `/orders/${g.order.id}?tab=garments`}
        getRowId={(g) => g.id}
        pagination={
          list.data
            ? {
                page,
                pageSize: list.data.pageSize,
                total: list.data.total,
                onPageChange: (p) => setState({ page: String(p) }, { resetPage: false }),
              }
            : undefined
        }
        empty={<EmptyState icon={Shirt} title="No garments here" description="Garments appear here as orders are created and processed." />}
      />
      <GarmentEditDialog garment={edit} description={edit?.orderLine.description} onOpenChange={(o) => !o && setEdit(null)} />
    </>
  );
}

/** Keyboard-wedge scanners type the tag and press Enter; works with manual typing too. */
function ScanPanel({ canUpdate }: { canUpdate: boolean }) {
  const [mode, setMode] = useState<ScanMode>(canUpdate ? 'PROCESSING' : 'lookup');
  const [value, setValue] = useState('');
  const [lookupTag, setLookupTag] = useState<string | null>(null);
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraOk] = useState(cameraScanSupported);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  const bulk = useBulkGarmentStatus();
  const lookup = useGarmentByTag(mode === 'lookup' ? lookupTag : null);

  const handle = useCallback(
    async (raw: string) => {
      const tag = raw.trim().toUpperCase();
      if (!tag) return;
      setValue('');
      if (mode === 'lookup') {
        setLookupTag(tag);
        return;
      }
      try {
        const res = await bulk.mutateAsync({ tagCodes: [tag], status: mode });
        const r = res.results[0]!;
        setLog((l) => [
          {
            id: ++counter.current,
            tag,
            ok: r.ok,
            message: r.ok ? `→ ${ORDER_STATUS_LABEL[mode]} (${r.orderNumber})` : (r.message ?? 'Failed'),
          },
          ...l.slice(0, 19),
        ]);
      } catch (err) {
        setLog((l) => [{ id: ++counter.current, tag, ok: false, message: errorMessage(err) }, ...l.slice(0, 19)]);
      }
      inputRef.current?.focus();
    },
    [mode, bulk],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">On scan:</span>
            {(['lookup', ...(canUpdate ? (['PROCESSING', 'QUALITY_CHECK', 'READY'] as const) : [])] as ScanMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  inputRef.current?.focus();
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium',
                  mode === m ? 'border-primary bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'lookup' ? 'Look up' : `Mark ${ORDER_STATUS_LABEL[m as OrderStatus]}`}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handle(value);
            }}
          >
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-primary" />
              <input
                ref={inputRef}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Scan or type a tag, e.g. GAR-000123"
                className="h-12 w-full rounded-lg border-2 border-primary/30 bg-card pr-3 pl-11 font-mono text-lg uppercase outline-none placeholder:font-sans placeholder:text-base placeholder:normal-case focus-visible:border-primary"
                aria-label="Tag code"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {cameraOk && (
              <Button type="button" variant="outline" className="h-12" onClick={() => setCameraOpen(true)} aria-label="Scan with camera">
                <Camera />
                <span className="hidden sm:inline">Camera</span>
              </Button>
            )}
            <Button type="submit" className="h-12" loading={bulk.isPending}>
              {mode === 'lookup' ? 'Find' : 'Update'}
            </Button>
          </form>
        </div>

        <div className="lg:w-[420px]">
          {mode === 'lookup' ? (
            lookupTag && <LookupResult tag={lookupTag} query={lookup} />
          ) : log.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Each scan moves the garment to <span className="font-medium text-foreground">{ORDER_STATUS_LABEL[mode as OrderStatus]}</span>.
              When all garments of an order reach a stage, the order follows automatically.
            </p>
          ) : (
            <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">
              {log.map((e) => (
                <li key={e.id} className="flex items-center gap-2 px-3 py-1.5">
                  {e.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-rose-600" />
                  )}
                  <span className="font-mono font-medium">{e.tag}</span>
                  <span className={cn('truncate', e.ok ? 'text-muted-foreground' : 'text-rose-700')}>{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <CameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={(v) => {
          setCameraOpen(false);
          void handle(v);
        }}
      />
    </Card>
  );
}

function LookupResult({ tag, query }: { tag: string; query: ReturnType<typeof useGarmentByTag> }) {
  const f = useFormat();
  if (query.isLoading) return <div className="h-24 animate-pulse rounded-lg bg-slate-100" />;
  if (query.error || !query.data) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
        {errorMessage(query.error, `No garment found with tag ${tag}.`)}
      </p>
    );
  }
  const g = query.data;
  return (
    <div className="rounded-lg border bg-slate-50/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono font-semibold">{g.tagCode}</p>
          <p>{g.orderLine.description}</p>
          <p className="text-xs text-muted-foreground">{[g.color, g.brand, g.fabric].filter(Boolean).join(' · ')}</p>
        </div>
        <StatusBadge status={g.status} />
      </div>
      <IssueBadges issues={g.issues} className="mt-1 block" />
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
        <Link href={`/orders/${g.order.id}?tab=garments`} className="font-mono font-medium text-primary hover:underline">
          {g.order.orderNumber}
        </Link>
        <span className="text-muted-foreground">
          {customerDisplayName(g.order.customer)} · due {f.shortDate(g.order.dueDate)}
        </span>
        {g.order.rack && (
          <Badge tone="teal">
            <Boxes />
            {g.order.rack.rackName} → {g.order.rack.slotCode}
          </Badge>
        )}
      </div>
    </div>
  );
}
