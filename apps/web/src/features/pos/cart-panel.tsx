'use client';

import {
  GARMENT_COLORS,
  GARMENT_ISSUE_LABEL,
  GARMENT_ISSUES,
  STAIN_TYPES,
  UNIT_TYPE_SHORT,
  type GarmentIssue,
  type PosCatalog,
} from '@rinseops/shared';
import { ChevronDown, Minus, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { GarmentIcon } from '@/components/shared/garment-icon';
import { MoneyDisplay } from '@/components/shared/money';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CartAction, CartState, CartSummary, PricedCartLine } from './cart';

interface CartPanelProps {
  state: CartState;
  summary: CartSummary;
  modifiers: PosCatalog['modifiers'];
  dispatch: (action: CartAction) => void;
  canDiscount: boolean;
  taxName: string;
  taxRate: string;
  taxInclusive: boolean;
}

export function CartLines({ summary, modifiers, dispatch }: Pick<CartPanelProps, 'summary' | 'modifiers' | 'dispatch'>) {
  if (!summary.lines.length) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500">
          <ShoppingBasket className="size-5" />
        </span>
        <p className="mt-3 text-sm font-medium">No items yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Tap items on the left to add them.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {summary.lines.map((line) => (
        <CartLineRow key={line.key} line={line} modifiers={modifiers} dispatch={dispatch} />
      ))}
    </ul>
  );
}

function CartLineRow({
  line,
  modifiers,
  dispatch,
}: {
  line: PricedCartLine;
  modifiers: PosCatalog['modifiers'];
  dispatch: (a: CartAction) => void;
}) {
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const isKg = line.unitType === 'KG';
  const step = isKg ? 0.5 : 1;
  const extras = line.modifierIds.length + line.issues.length + line.stains.length + (line.color ? 1 : 0) + (line.notes ? 1 : 0);
  const swatch = GARMENT_COLORS.find((c) => c.name === line.color);

  return (
    <li className={cn('py-2.5', !line.valid && 'bg-rose-50/60', open && 'bg-amber-50/40')}>
      <div className="flex items-start gap-2.5">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-lg border bg-slate-50">
          <GarmentIcon name={line.itemName} icon={line.icon} className="size-8" />
          {swatch && (
            <span
              className="absolute -right-1 -bottom-1 size-3.5 rounded-full border-2 border-white shadow-sm"
              style={{ background: swatch.hex }}
              aria-label={`Colour ${swatch.name}`}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{line.itemName}</p>
            <MoneyDisplay value={line.lineTotal} className="text-sm font-semibold" />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {line.categoryName}
            {line.unitPrice && (
              <>
                {' · '}
                {f.money(line.unitPrice)}/{UNIT_TYPE_SHORT[line.unitType]}
              </>
            )}
            {line.tags > 0 && ` · ${line.tags} tag${line.tags === 1 ? '' : 's'}`}
          </p>
          {(line.issues.length > 0 || line.stains.length > 0 || line.color) && !open && (
            <p className="mt-0.5 truncate text-[11px] text-amber-800">
              {[line.color, ...line.issues.map((i) => GARMENT_ISSUE_LABEL[i]), ...line.stains.map((s) => `${s} stain`)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-[54px]">
        <div className="flex items-center rounded-md border bg-card">
          <button
            type="button"
            className="grid size-8 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => dispatch({ type: 'inc', key: line.key, delta: -step })}
            aria-label={`Decrease ${line.itemName}`}
          >
            <Minus className="size-3.5" />
          </button>
          <input
            value={line.quantity}
            onChange={(e) => dispatch({ type: 'setQty', key: line.key, quantity: e.target.value.replace(/[^\d.]/g, '') })}
            inputMode="decimal"
            className="tabular h-8 w-12 border-x text-center text-sm outline-none focus-visible:bg-primary-soft/40"
            aria-label={`Quantity of ${line.itemName}`}
          />
          <button
            type="button"
            className="grid size-8 place-items-center text-muted-foreground hover:text-foreground"
            onClick={() => dispatch({ type: 'inc', key: line.key, delta: step })}
            aria-label={`Increase ${line.itemName}`}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {isKg && <span className="text-xs text-muted-foreground">kg</span>}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-slate-100 hover:text-foreground',
            extras > 0 && 'text-primary',
          )}
          aria-expanded={open}
        >
          Item props{extras > 0 && ` (${extras})`}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'remove', key: line.key })}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Remove ${line.itemName}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {!line.valid && (
        <p className="mt-1 pl-[54px] text-xs text-rose-600">
          {line.unitPrice ? 'Enter a valid quantity.' : 'Not offered in this price list — remove it or choose another service.'}
        </p>
      )}
      {open && <ItemProps line={line} modifiers={modifiers} dispatch={dispatch} />}
    </li>
  );
}

/** Condition, stains, colour, add-ons and instructions recorded at intake. */
function ItemProps({
  line,
  modifiers,
  dispatch,
}: {
  line: PricedCartLine;
  modifiers: PosCatalog['modifiers'];
  dispatch: (a: CartAction) => void;
}) {
  const f = useFormat();
  const update = (patch: Extract<CartAction, { type: 'update' }>['patch']) => dispatch({ type: 'update', key: line.key, patch });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const heading = 'mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase';
  const chip = (on: boolean) =>
    cn(
      'rounded-full border px-2.5 py-1 text-xs transition-colors',
      on ? 'border-amber-400 bg-amber-100 font-medium text-amber-900' : 'bg-card text-foreground/80 hover:border-slate-300',
    );

  return (
    <div className="mt-2.5 grid gap-3 rounded-xl border bg-card p-3 shadow-xs">
      <div>
        <p className={heading}>Condition</p>
        <div className="flex flex-wrap gap-1.5">
          {GARMENT_ISSUES.filter((i) => i !== 'STAIN').map((issue) => {
            const on = line.issues.includes(issue);
            return (
              <button
                key={issue}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() => update({ issues: toggle(line.issues, issue as GarmentIssue) })}
              >
                {GARMENT_ISSUE_LABEL[issue]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={heading}>Stains</p>
        <div className="flex flex-wrap gap-1.5">
          {STAIN_TYPES.map((stain) => {
            const on = line.stains.includes(stain);
            return (
              <button
                key={stain}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() => update({ stains: toggle(line.stains, stain) })}
              >
                {stain}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={heading}>Colour{line.color && <span className="ml-1 font-normal normal-case">· {line.color}</span>}</p>
        <div className="flex flex-wrap gap-1.5">
          {GARMENT_COLORS.map((c) => {
            const on = line.color === c.name;
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={on}
                onClick={() => update({ color: on ? '' : c.name })}
                className={cn(
                  'size-7 rounded-md border shadow-xs transition-transform hover:scale-110',
                  on ? 'ring-2 ring-primary ring-offset-2' : 'border-slate-300',
                )}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
      </div>
      {modifiers.length > 0 && (
        <div>
          <p className={heading}>Add-ons</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {modifiers.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={line.modifierIds.includes(m.id)}
                  onCheckedChange={() => update({ modifierIds: toggle(line.modifierIds, m.id) })}
                />
                {m.name}
                <span className="text-muted-foreground">{m.type === 'PERCENT' ? `+${Number(m.value)}%` : `+${f.money(m.value)}`}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <Input
        value={line.notes}
        onChange={(e) => update({ notes: e.target.value })}
        placeholder="Instructions, e.g. light starch, on hanger"
        className="h-8 text-xs"
        aria-label="Instructions"
      />
      <p className="text-[11px] text-muted-foreground">Applies to every tag on this line. Fine-tune individual garments after saving.</p>
    </div>
  );
}

export function DiscountRow({ state, dispatch, canDiscount }: Pick<CartPanelProps, 'state' | 'dispatch' | 'canDiscount'>) {
  if (!canDiscount) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Discount</span>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Discount type">
          {(['PERCENT', 'FIXED'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => dispatch({ type: 'discount', discountType: t })}
              className={cn(
                'h-7 rounded px-2 text-xs font-medium',
                state.discountType === t ? 'bg-slate-900 text-white' : 'text-muted-foreground',
              )}
              aria-pressed={state.discountType === t}
            >
              {t === 'PERCENT' ? '%' : 'Amt'}
            </button>
          ))}
        </div>
        <Input
          value={state.discountValue}
          onChange={(e) => dispatch({ type: 'discount', discountValue: e.target.value.replace(/[^\d.]/g, '') })}
          inputMode="decimal"
          placeholder="0"
          className="tabular h-8 w-20 text-right"
          aria-label="Discount value"
        />
      </div>
    </div>
  );
}

export function TotalsBlock({
  summary,
  taxName,
  taxRate,
  taxInclusive,
}: Pick<CartPanelProps, 'summary' | 'taxName' | 'taxRate' | 'taxInclusive'>) {
  const t = summary.totals;
  const row = 'flex items-center justify-between text-sm';
  return (
    <div className="grid gap-1.5">
      <div className={row}>
        <span className="text-muted-foreground">
          Subtotal · {summary.pieces} pc{summary.pieces === 1 ? '' : 's'}
        </span>
        <MoneyDisplay value={t.subtotal} />
      </div>
      {Number(t.discountAmount) > 0 && (
        <div className={cn(row, 'text-emerald-700')}>
          <span>Discount</span>
          <span className="tabular">
            − <MoneyDisplay value={t.discountAmount} />
          </span>
        </div>
      )}
      {Number(taxRate) > 0 && (
        <div className={row}>
          <span className="text-muted-foreground">
            {taxName} {Number(taxRate)}%{taxInclusive ? ' (incl.)' : ''}
          </span>
          <MoneyDisplay value={t.taxAmount} />
        </div>
      )}
      <div className="mt-1 flex items-baseline justify-between border-t pt-2">
        <span className="text-sm font-semibold">Total</span>
        <MoneyDisplay value={t.grandTotal} className="text-xl font-semibold tracking-tight" />
      </div>
    </div>
  );
}
