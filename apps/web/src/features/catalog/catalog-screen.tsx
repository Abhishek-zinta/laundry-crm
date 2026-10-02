'use client';

import { GarmentIcon } from '@/components/shared/garment-icon';
import {
  Permission,
  UNIT_TYPE_LABEL,
  type CatalogOverview,
  type ModifierDto,
  type PriceListDto,
  type ServiceCategoryDto,
  type ServiceItemDto,
} from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useUrlState } from '@/lib/url-state';
import { useCatalogOverview, useSetDefaultPriceList, useUpdateCategory, useUpdateItem, useUpdateModifier, useUpdatePriceList } from './api';
import { CategoryDialog, ItemDialog, ModifierDialog, PriceListDialog } from './catalog-dialogs';
import { PriceMatrix } from './price-matrix';

type Tab = 'prices' | 'services' | 'items' | 'addons';

export function CatalogScreen() {
  const { can } = useSession();
  const editable = can(Permission.CATALOG_MANAGE);
  const [url, setUrl] = useUrlState({ tab: 'prices', list: undefined as string | undefined });
  const overview = useCatalogOverview();

  return (
    <>
      <PageHeader title="Services & Pricing" description="Services, garment types, price lists and add-ons used at the counter." />
      <Tabs value={url.tab} onValueChange={(t) => setUrl({ tab: t as Tab })}>
        <TabsList className="mb-4">
          <TabsTrigger value="prices">Price lists</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>
        {overview.isLoading ? (
          <Card className="grid gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </Card>
        ) : overview.error || !overview.data ? (
          <Card>
            <ErrorState message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
          </Card>
        ) : (
          <>
            <TabsContent value="prices">
              <PriceListsTab
                overview={overview.data}
                editable={editable}
                selectedId={url.list}
                onSelect={(id) => setUrl({ list: id }, { resetPage: false })}
              />
            </TabsContent>
            <TabsContent value="services">
              <ServicesTab categories={overview.data.categories} editable={editable} />
            </TabsContent>
            <TabsContent value="items">
              <ItemsTab items={overview.data.items} editable={editable} />
            </TabsContent>
            <TabsContent value="addons">
              <AddonsTab modifiers={overview.data.modifiers} editable={editable} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------

function PriceListsTab({
  overview,
  editable,
  selectedId,
  onSelect,
}: {
  overview: CatalogOverview;
  editable: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { can } = useSession();
  const lists = overview.priceLists;
  const current = lists.find((l) => l.id === selectedId) ?? lists.find((l) => l.isTenantDefault) ?? lists[0];
  const [dialog, setDialog] = useState<{ open: boolean; editing: PriceListDto | null }>({ open: false, editing: null });
  const updateList = useUpdatePriceList();
  const setDefault = useSetDefaultPriceList();

  if (!lists.length || !current) {
    return (
      <Card>
        <EmptyState
          title="No price lists yet"
          description="Create a price list to start pricing your services."
          action={
            editable && (
              <Button onClick={() => setDialog({ open: true, editing: null })}>
                <Plus /> New price list
              </Button>
            )
          }
        />
        <PriceListDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
          priceLists={lists}
          onCreated={onSelect}
        />
      </Card>
    );
  }

  const toggleActive = async () => {
    try {
      await updateList.mutateAsync({ id: current.id, input: { isActive: !current.isActive } });
      toast.success(current.isActive ? 'Price list deactivated' : 'Price list activated');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const makeDefault = async () => {
    try {
      await setDefault.mutateAsync(current.id);
      toast.success(`${current.name} is now the default price list`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <NativeSelect aria-label="Price list" className="w-auto min-w-48" value={current.id} onChange={(e) => onSelect(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.isTenantDefault ? ' (default)' : ''}
                {!l.isActive ? ' — inactive' : ''}
              </option>
            ))}
          </NativeSelect>
          {current.isTenantDefault && (
            <Badge tone="teal">
              <Star /> Business default
            </Badge>
          )}
          {current.store && <Badge tone="blue">{current.store.name} only</Badge>}
          {current.isDefault && current.store && <Badge tone="outline">Store default</Badge>}
          {!current.isActive && <Badge tone="red">Inactive</Badge>}
          <span className="text-xs text-muted-foreground">
            {current._count.items} prices · {current._count.customers} customers
          </span>
        </div>
        {editable && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, editing: null })}>
              <Plus /> New list
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label="Price list actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setDialog({ open: true, editing: current })}>
                  <Pencil /> Edit details
                </DropdownMenuItem>
                {can(Permission.SETTINGS_MANAGE) && !current.isTenantDefault && current.isActive && (
                  <DropdownMenuItem onSelect={() => void makeDefault()}>
                    <Star /> Make business default
                  </DropdownMenuItem>
                )}
                {!current.isTenantDefault && (
                  <DropdownMenuItem destructive={current.isActive} onSelect={() => void toggleActive()}>
                    {current.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {current.description && <p className="border-b bg-slate-50/60 px-4 py-2 text-xs text-muted-foreground">{current.description}</p>}
      <PriceMatrix key={current.id} priceListId={current.id} overview={overview} editable={editable} />
      <PriceListDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        editing={dialog.editing}
        priceLists={lists}
        onCreated={onSelect}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ActiveSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} data-no-row-click />;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="ghost" onClick={onClick} aria-label="Edit">
      <Pencil />
    </Button>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ServicesTab({ categories, editable }: { categories: ServiceCategoryDto[]; editable: boolean }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing: ServiceCategoryDto | null }>({ open: false, editing: null });
  const update = useUpdateCategory();
  const columns: ColumnDef<ServiceCategoryDto>[] = [
    {
      header: 'Service',
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium">
          <span className="size-2.5 rounded-full" style={{ background: row.original.color ?? '#94a3b8' }} />
          {row.original.name}
        </span>
      ),
    },
    { header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    {
      header: 'Description',
      meta: { hideOnMobile: true, className: 'max-w-xs truncate' },
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description ?? '—'}</span>,
    },
    {
      header: 'Order',
      meta: { align: 'right', hideOnMobile: true },
      cell: ({ row }) => <span className="tabular">{row.original.displayOrder}</span>,
    },
    {
      header: 'Active',
      cell: ({ row }) => (
        <ActiveSwitch
          label={`${row.original.name} active`}
          checked={row.original.isActive}
          disabled={!editable || update.isPending}
          onChange={(v) =>
            update.mutate({ id: row.original.id, input: { isActive: v } }, { onError: (err) => toast.error(errorMessage(err)) })
          }
        />
      ),
    },
    ...(editable
      ? [
          {
            id: 'edit',
            header: '',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: ServiceCategoryDto } }) => (
              <EditButton onClick={() => setDialog({ open: true, editing: row.original })} />
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <SectionHeader
        title="Services"
        description="Categories of work, such as Dry Cleaning or Wash & Fold. Each becomes a column in the price list."
        action={
          editable && (
            <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
              <Plus /> New service
            </Button>
          )
        }
      />
      <DataTable columns={columns} data={categories} getRowId={(r) => r.id} empty={<EmptyState compact title="No services yet" />} />
      <CategoryDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} editing={dialog.editing} />
    </>
  );
}

function ItemsTab({ items, editable }: { items: ServiceItemDto[]; editable: boolean }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing: ServiceItemDto | null }>({ open: false, editing: null });
  const update = useUpdateItem();
  const columns: ColumnDef<ServiceItemDto>[] = [
    {
      header: 'Item',
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5">
          <GarmentIcon name={row.original.name} icon={row.original.icon} className="size-8" />
          <span className="font-medium">{row.original.name}</span>
        </span>
      ),
    },
    { header: 'Priced', cell: ({ row }) => <Badge tone="outline">{UNIT_TYPE_LABEL[row.original.unitType]}</Badge> },
    {
      header: 'Tags per unit',
      meta: { align: 'right' },
      cell: ({ row }) => <span className="tabular">{row.original.unitType === 'KG' ? '1 bag' : row.original.piecesPerUnit}</span>,
    },
    {
      header: 'Order',
      meta: { align: 'right', hideOnMobile: true },
      cell: ({ row }) => <span className="tabular">{row.original.displayOrder}</span>,
    },
    {
      header: 'Active',
      cell: ({ row }) => (
        <ActiveSwitch
          label={`${row.original.name} active`}
          checked={row.original.isActive}
          disabled={!editable || update.isPending}
          onChange={(v) =>
            update.mutate({ id: row.original.id, input: { isActive: v } }, { onError: (err) => toast.error(errorMessage(err)) })
          }
        />
      ),
    },
    ...(editable
      ? [
          {
            id: 'edit',
            header: '',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: ServiceItemDto } }) => (
              <EditButton onClick={() => setDialog({ open: true, editing: row.original })} />
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <SectionHeader
        title="Items"
        description="Garment and product types. Each becomes a row in the price list and generates garment tags."
        action={
          editable && (
            <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
              <Plus /> New item
            </Button>
          )
        }
      />
      <DataTable columns={columns} data={items} getRowId={(r) => r.id} empty={<EmptyState compact title="No items yet" />} />
      <ItemDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} editing={dialog.editing} />
    </>
  );
}

function AddonsTab({ modifiers, editable }: { modifiers: ModifierDto[]; editable: boolean }) {
  const f = useFormat();
  const [dialog, setDialog] = useState<{ open: boolean; editing: ModifierDto | null }>({ open: false, editing: null });
  const update = useUpdateModifier();
  const columns: ColumnDef<ModifierDto>[] = [
    { header: 'Add-on', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      header: 'Charge',
      cell: ({ row }) => (
        <span className="tabular">
          {row.original.type === 'PERCENT' ? `+${Number(row.original.value)}%` : `+${f.money(row.original.value)} / unit`}
        </span>
      ),
    },
    {
      header: 'Active',
      cell: ({ row }) => (
        <ActiveSwitch
          label={`${row.original.name} active`}
          checked={row.original.isActive ?? true}
          disabled={!editable || update.isPending}
          onChange={(v) =>
            update.mutate({ id: row.original.id, input: { isActive: v } }, { onError: (err) => toast.error(errorMessage(err)) })
          }
        />
      ),
    },
    ...(editable
      ? [
          {
            id: 'edit',
            header: '',
            meta: { align: 'right' as const },
            cell: ({ row }: { row: { original: ModifierDto } }) => (
              <EditButton onClick={() => setDialog({ open: true, editing: row.original })} />
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <SectionHeader
        title="Add-ons"
        description="Optional extras applied per line at the counter, like Express Service or Stain Treatment."
        action={
          editable && (
            <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
              <Plus /> New add-on
            </Button>
          )
        }
      />
      <DataTable columns={columns} data={modifiers} getRowId={(r) => r.id} empty={<EmptyState compact title="No add-ons yet" />} />
      <ModifierDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} editing={dialog.editing} />
    </>
  );
}
