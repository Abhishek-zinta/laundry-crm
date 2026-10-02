'use client';

import { createStoreSchema, type StoreDto } from '@rinseops/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { DataTable } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useCreateStore, useStoresAdmin, useUpdateStore } from './api';

function StoreDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: StoreDto | null }) {
  const create = useCreateStore();
  const update = useUpdateStore();
  const form = useZodForm(createStoreSchema, { defaultValues: { name: '', code: '', phone: '', address: '', isActive: true } });
  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? '',
        code: editing?.code ?? '',
        phone: editing?.phone ?? '',
        address: editing?.address ?? '',
        isActive: editing?.isActive ?? true,
      });
    }
  }, [open, editing, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values });
      else await create.mutateAsync(values);
      toast.success(editing ? 'Store updated' : 'Store created');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this store.");
    }
  });
  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit store' : 'New store'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Name" required error={errors.name?.message} className="col-span-2">
                <Input autoFocus {...form.register('name')} />
              </Field>
              <Field label="Code" required error={errors.code?.message}>
                <Input className="uppercase" placeholder="DT" {...form.register('code')} />
              </Field>
            </div>
            <Field label="Phone" error={errors.phone?.message}>
              <Input type="tel" {...form.register('phone')} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Textarea rows={2} {...form.register('address')} />
            </Field>
            {editing && (
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="store-active">Store is active</Label>
                    <Switch id="store-active" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editing ? 'Save' : 'Create store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StoresSettings() {
  const stores = useStoresAdmin();
  const [dialog, setDialog] = useState<{ open: boolean; editing: StoreDto | null }>({ open: false, editing: null });

  const columns: ColumnDef<StoreDto>[] = [
    {
      header: 'Store',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.address && <p className="max-w-xs truncate text-xs text-muted-foreground">{row.original.address}</p>}
        </div>
      ),
    },
    { header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { header: 'Phone', meta: { hideOnMobile: true }, cell: ({ row }) => row.original.phone ?? '—' },
    {
      header: 'Staff · Racks',
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span className="tabular text-muted-foreground">
          {row.original._count?.users ?? 0} · {row.original._count?.racks ?? 0}
        </span>
      ),
    },
    { header: 'Status', cell: ({ row }) => (row.original.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
    {
      id: 'edit',
      header: '',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Edit ${row.original.name}`}
          onClick={() => setDialog({ open: true, editing: row.original })}
        >
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Stores</h2>
          <p className="text-xs text-muted-foreground">Each store has its own racks, orders and staff assignments.</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
          <Plus /> New store
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={stores.data}
        loading={stores.isLoading}
        error={stores.error}
        onRetry={() => void stores.refetch()}
        getRowId={(r) => r.id}
        empty={<EmptyState icon={Store} compact title="No stores yet" />}
      />
      <StoreDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} editing={dialog.editing} />
    </>
  );
}
