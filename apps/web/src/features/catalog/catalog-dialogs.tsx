'use client';

import { GARMENT_ICON_KEYS, GARMENT_ICON_LABEL, type GarmentIconKey } from '@rinseops/shared';
import { GarmentIcon } from '@/components/shared/garment-icon';
import { cn } from '@/lib/utils';
import {
  createModifierSchema,
  createPriceListSchema,
  createServiceCategorySchema,
  createServiceItemSchema,
  UNIT_TYPE_LABEL,
  UNIT_TYPES,
  type ModifierDto,
  type PriceListDto,
  type ServiceCategoryDto,
  type ServiceItemDto,
} from '@rinseops/shared';
import { useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applyApiError, useZodForm } from '@/lib/forms';
import { useSession } from '@/lib/session';
import {
  useCreateCategory,
  useCreateItem,
  useCreateModifier,
  useCreatePriceList,
  useUpdateCategory,
  useUpdateItem,
  useUpdateModifier,
  useUpdatePriceList,
} from './api';

interface DialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: T | null;
}

function FormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  pending,
  submitLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  pending: boolean;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={onSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-3">{children}</DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

export function CategoryDialog({ open, onOpenChange, editing }: DialogProps<ServiceCategoryDto>) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const form = useZodForm(createServiceCategorySchema, {
    defaultValues: { name: '', code: '', description: '', color: '#0f766e', displayOrder: 0, isActive: true },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? '',
      code: editing?.code ?? '',
      description: editing?.description ?? '',
      color: editing?.color ?? '#0f766e',
      displayOrder: editing?.displayOrder ?? 0,
      isActive: editing?.isActive ?? true,
    });
  }, [open, editing, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values });
      else await create.mutateAsync(values);
      toast.success(editing ? 'Service updated' : 'Service added');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this service.");
    }
  });
  const { errors } = form.formState;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit service' : 'New service'}
      onSubmit={submit}
      pending={create.isPending || update.isPending}
      submitLabel={editing ? 'Save' : 'Add service'}
    >
      <Field label="Name" required error={errors.name?.message}>
        <Input autoFocus placeholder="e.g. Dry Cleaning" {...form.register('name')} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Code" required error={errors.code?.message} className="col-span-2">
          <Input placeholder="DC" className="uppercase" {...form.register('code')} />
        </Field>
        <Field label="Colour" error={errors.color?.message}>
          <Input type="color" className="p-1" {...form.register('color')} />
        </Field>
      </div>
      <Field label="Description" error={errors.description?.message}>
        <Textarea rows={2} {...form.register('description')} />
      </Field>
      <Field label="Display order" error={errors.displayOrder?.message}>
        <Input type="number" min={0} {...form.register('displayOrder')} />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------

export function ItemDialog({ open, onOpenChange, editing }: DialogProps<ServiceItemDto>) {
  const create = useCreateItem();
  const update = useUpdateItem();
  const form = useZodForm(createServiceItemSchema, {
    defaultValues: { name: '', unitType: 'PIECE', piecesPerUnit: 1, icon: null, displayOrder: 0, isActive: true },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? '',
      unitType: editing?.unitType ?? 'PIECE',
      piecesPerUnit: editing?.piecesPerUnit ?? 1,
      icon: (editing?.icon as GarmentIconKey | null) ?? null,
      displayOrder: editing?.displayOrder ?? 0,
      isActive: editing?.isActive ?? true,
    });
  }, [open, editing, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values });
      else await create.mutateAsync(values);
      toast.success(editing ? 'Item updated' : 'Item added');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this item.");
    }
  });
  const { errors } = form.formState;
  const unitType = form.watch('unitType');
  const icon = form.watch('icon');
  const name = form.watch('name');

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit item' : 'New item'}
      onSubmit={submit}
      pending={create.isPending || update.isPending}
      submitLabel={editing ? 'Save' : 'Add item'}
    >
      <Field label="Name" required error={errors.name?.message}>
        <Input autoFocus placeholder="e.g. Shirt" {...form.register('name')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priced" error={errors.unitType?.message}>
          <NativeSelect {...form.register('unitType')}>
            {UNIT_TYPES.map((u) => (
              <option key={u} value={u}>
                {UNIT_TYPE_LABEL[u]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Tags per unit"
          error={errors.piecesPerUnit?.message}
          hint={unitType === 'KG' ? 'Weighed lines get one bag tag.' : 'e.g. 2 for a two-piece suit'}
        >
          <Input type="number" min={1} max={20} disabled={unitType === 'KG'} {...form.register('piecesPerUnit')} />
        </Field>
      </div>
      <Field label="Display order" error={errors.displayOrder?.message}>
        <Input type="number" min={0} {...form.register('displayOrder')} />
      </Field>
      <Field label="Illustration" hint="Shown on POS tiles. Auto picks one from the item name.">
        <div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto rounded-lg border p-1.5 sm:grid-cols-8">
          <button
            type="button"
            onClick={() => form.setValue('icon', null, { shouldDirty: true })}
            className={cn(
              'flex flex-col items-center rounded-md p-1 text-[10px] text-muted-foreground hover:bg-slate-50',
              !icon && 'bg-primary-soft ring-2 ring-primary',
            )}
            title="Auto"
          >
            <GarmentIcon name={name || 'item'} className="size-8" />
            Auto
          </button>
          {GARMENT_ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => form.setValue('icon', key, { shouldDirty: true })}
              className={cn(
                'grid place-items-center rounded-md p-1 hover:bg-slate-50',
                icon === key && 'bg-primary-soft ring-2 ring-primary',
              )}
              title={GARMENT_ICON_LABEL[key]}
              aria-label={GARMENT_ICON_LABEL[key]}
              aria-pressed={icon === key}
            >
              <GarmentIcon name={key} icon={key} className="size-8" />
            </button>
          ))}
        </div>
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------

export function ModifierDialog({ open, onOpenChange, editing }: DialogProps<ModifierDto>) {
  const create = useCreateModifier();
  const update = useUpdateModifier();
  const form = useZodForm(createModifierSchema, {
    defaultValues: { name: '', type: 'PERCENT', value: '', displayOrder: 0, isActive: true },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? '',
      type: editing?.type ?? 'PERCENT',
      value: editing?.value ?? '',
      displayOrder: editing?.displayOrder ?? 0,
      isActive: editing?.isActive ?? true,
    });
  }, [open, editing, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: values });
      else await create.mutateAsync(values);
      toast.success(editing ? 'Add-on updated' : 'Add-on created');
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this add-on.");
    }
  });
  const { errors } = form.formState;
  const type = form.watch('type');

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit add-on' : 'New add-on'}
      onSubmit={submit}
      pending={create.isPending || update.isPending}
      submitLabel={editing ? 'Save' : 'Create add-on'}
    >
      <Field label="Name" required error={errors.name?.message}>
        <Input autoFocus placeholder="e.g. Express Service" {...form.register('name')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" error={errors.type?.message}>
          <NativeSelect {...form.register('type')}>
            <option value="PERCENT">Percentage of line</option>
            <option value="FIXED">Fixed amount per unit</option>
          </NativeSelect>
        </Field>
        <Field label={type === 'PERCENT' ? 'Percent (%)' : 'Amount per unit'} required error={errors.value?.message}>
          <Input inputMode="decimal" {...form.register('value')} />
        </Field>
      </div>
      <Field label="Display order" error={errors.displayOrder?.message}>
        <Input type="number" min={0} {...form.register('displayOrder')} />
      </Field>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------

export function PriceListDialog({
  open,
  onOpenChange,
  editing,
  priceLists,
  onCreated,
}: DialogProps<PriceListDto> & { priceLists: PriceListDto[]; onCreated?: (id: string) => void }) {
  const { me } = useSession();
  const create = useCreatePriceList();
  const update = useUpdatePriceList();
  const form = useZodForm(createPriceListSchema, {
    defaultValues: { name: '', description: '', storeId: null, isDefault: false, isActive: true, copyFromPriceListId: undefined },
  });
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      storeId: editing?.storeId ?? null,
      isDefault: editing?.isDefault ?? false,
      isActive: editing?.isActive ?? true,
      copyFromPriceListId: editing ? undefined : priceLists.find((p) => p.isTenantDefault)?.id,
    });
  }, [open, editing, form, priceLists]);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const { copyFromPriceListId: _ignored, ...rest } = values;
        void _ignored;
        await update.mutateAsync({ id: editing.id, input: rest });
        toast.success('Price list updated');
      } else {
        const created = await create.mutateAsync(values);
        toast.success('Price list created');
        onCreated?.(created.id);
      }
      onOpenChange(false);
    } catch (err) {
      applyApiError(form, err, "We couldn't save this price list.");
    }
  });
  const { errors } = form.formState;
  const storeId = form.watch('storeId');

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit price list' : 'New price list'}
      onSubmit={submit}
      pending={create.isPending || update.isPending}
      submitLabel={editing ? 'Save' : 'Create price list'}
    >
      <Field label="Name" required error={errors.name?.message}>
        <Input autoFocus placeholder="e.g. VIP, Corporate" {...form.register('name')} />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <Input {...form.register('description')} />
      </Field>
      <Field label="Applies to" hint="Store-specific lists are used automatically at that store.">
        <NativeSelect {...form.register('storeId', { setValueAs: (v: string) => (v ? v : null) })}>
          <option value="">All stores</option>
          {me.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} only
            </option>
          ))}
        </NativeSelect>
      </Field>
      {!editing && (
        <Field label="Start with prices from">
          <NativeSelect {...form.register('copyFromPriceListId', { setValueAs: (v: string) => (v ? v : undefined) })}>
            <option value="">Blank — set prices later</option>
            {priceLists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {storeId && (
        <Controller
          control={form.control}
          name="isDefault"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox id="pl-default" checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="pl-default">Default list for this store</Label>
            </div>
          )}
        />
      )}
    </FormDialog>
  );
}
