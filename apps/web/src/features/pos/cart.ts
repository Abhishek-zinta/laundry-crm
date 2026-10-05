import {
  calculateOrderTotals,
  garmentUnitsForLine,
  type DiscountType,
  type GarmentIssue,
  type orderLineInputSchema,
  type PosCatalog,
  type PricingResult,
  type TenantSettingsDto,
  type UnitType,
} from '@rinseops/shared';
import type { z } from 'zod';
import { randomId } from '@/lib/utils';

/**
 * POS cart state. Lines keep only ids + quantity; prices are always derived
 * from the current price list so changing the customer (e.g. VIP pricing)
 * re-prices the cart instantly. The API recalculates everything on save.
 */
export interface CartLine {
  key: string;
  serviceCategoryId: string;
  serviceItemId: string;
  quantity: string;
  modifierIds: string[];
  notes: string;
  color: string;
  issues: GarmentIssue[];
  /** Stain types noted at intake (Blood, Grease…). */
  stains: string[];
}

export interface CartState {
  lines: CartLine[];
  discountType: DiscountType;
  discountValue: string;
}

export const emptyCart: CartState = { lines: [], discountType: 'PERCENT', discountValue: '' };

export type CartAction =
  | { type: 'add'; serviceCategoryId: string; serviceItemId: string; quantity?: string }
  | { type: 'setQty'; key: string; quantity: string }
  | { type: 'inc'; key: string; delta: number }
  | { type: 'remove'; key: string }
  | { type: 'update'; key: string; patch: Partial<Pick<CartLine, 'modifierIds' | 'notes' | 'color' | 'issues' | 'stains'>> }
  | { type: 'discount'; discountType?: DiscountType; discountValue?: string }
  | { type: 'reset'; state?: CartState };

const isPlain = (l: CartLine) => !l.modifierIds.length && !l.notes && !l.color && !l.issues.length && !l.stains.length;

function fmtQty(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const qty = action.quantity ?? '1';
      const existing = state.lines.find(
        (l) => l.serviceCategoryId === action.serviceCategoryId && l.serviceItemId === action.serviceItemId && isPlain(l),
      );
      if (existing && !action.quantity) {
        return {
          ...state,
          lines: state.lines.map((l) => (l === existing ? { ...l, quantity: fmtQty(Number(l.quantity) + 1) } : l)),
        };
      }
      const line: CartLine = {
        key: randomId(),
        serviceCategoryId: action.serviceCategoryId,
        serviceItemId: action.serviceItemId,
        quantity: qty,
        modifierIds: [],
        notes: '',
        color: '',
        issues: [],
        stains: [],
      };
      return { ...state, lines: [...state.lines, line] };
    }
    case 'setQty':
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: action.quantity } : l)) };
    case 'inc':
      return {
        ...state,
        lines: state.lines
          .map((l) => (l.key === action.key ? { ...l, quantity: fmtQty(Math.max(0, Number(l.quantity || 0) + action.delta)) } : l))
          .filter((l) => Number(l.quantity) > 0),
      };
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case 'update':
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, ...action.patch } : l)) };
    case 'discount':
      return {
        ...state,
        discountType: action.discountType ?? state.discountType,
        discountValue: action.discountValue ?? state.discountValue,
      };
    case 'reset':
      return action.state ?? emptyCart;
  }
}

export interface PricedCartLine extends CartLine {
  categoryName: string;
  itemName: string;
  icon: string | null;
  unitType: UnitType;
  piecesPerUnit: number;
  unitPrice: string | null;
  lineTotal: string;
  modifiersAmount: string;
  tags: number;
  valid: boolean;
}

export interface CartSummary {
  lines: PricedCartLine[];
  totals: PricingResult;
  pieces: number;
  hasInvalid: boolean;
  hasInvalidQty: boolean;
}

const QTY_RE = /^\d{1,6}(\.\d{1,3})?$/;

/** Prices the cart with the shared pricing engine (same as the API). */
export function priceCart(
  state: CartState,
  catalog: PosCatalog | undefined,
  settings: Pick<TenantSettingsDto, 'taxRate' | 'taxInclusive'>,
): CartSummary {
  const lookup = new Map<
    string,
    { categoryName: string; itemName: string; icon: string | null; unitType: UnitType; piecesPerUnit: number; price: string }
  >();
  for (const c of catalog?.categories ?? []) {
    for (const i of c.items) {
      lookup.set(`${c.id}:${i.serviceItemId}`, {
        categoryName: c.name,
        itemName: i.name,
        icon: i.icon,
        unitType: i.unitType,
        piecesPerUnit: i.piecesPerUnit,
        price: i.price,
      });
    }
  }
  const modifiers = new Map((catalog?.modifiers ?? []).map((m) => [m.id, m]));

  const partial = state.lines.map((l) => {
    const info = lookup.get(`${l.serviceCategoryId}:${l.serviceItemId}`);
    const qtyOk = QTY_RE.test(l.quantity) && Number(l.quantity) > 0;
    return { l, info, qtyOk };
  });
  const priceable = partial.filter((p) => p.info && p.qtyOk);
  const totals = calculateOrderTotals({
    lines: priceable.map(({ l, info }) => ({
      unitPrice: info!.price,
      quantity: l.quantity,
      modifiers: l.modifierIds.flatMap((id) => {
        const m = modifiers.get(id);
        return m ? [{ type: m.type, value: m.value }] : [];
      }),
    })),
    discount: state.discountValue && Number(state.discountValue) > 0 ? { type: state.discountType, value: state.discountValue } : null,
    taxRate: settings.taxRate,
    taxInclusive: settings.taxInclusive,
  });

  let pricedIndex = 0;
  let pieces = 0;
  const lines: PricedCartLine[] = partial.map(({ l, info, qtyOk }) => {
    const priced = info && qtyOk ? totals.lines[pricedIndex++] : undefined;
    const tags = info && qtyOk ? garmentUnitsForLine(info.unitType, l.quantity, info.piecesPerUnit) : 0;
    pieces += tags;
    return {
      ...l,
      categoryName: info?.categoryName ?? 'Unavailable',
      itemName: info?.itemName ?? 'Item not in this price list',
      icon: info?.icon ?? null,
      unitType: info?.unitType ?? 'PIECE',
      piecesPerUnit: info?.piecesPerUnit ?? 1,
      unitPrice: info?.price ?? null,
      lineTotal: priced?.lineTotal ?? '0.00',
      modifiersAmount: priced?.modifiersAmount ?? '0.00',
      tags,
      valid: Boolean(info) && qtyOk,
    };
  });

  return {
    lines,
    totals,
    pieces,
    hasInvalid: partial.some((p) => !p.info),
    hasInvalidQty: partial.some((p) => !p.qtyOk),
  };
}

/** Converts priced cart lines to the API payload. */
export function toOrderLines(lines: PricedCartLine[]): Array<z.input<typeof orderLineInputSchema>> {
  return lines.map((l) => {
    const issues: GarmentIssue[] = l.stains.length && !l.issues.includes('STAIN') ? [...l.issues, 'STAIN'] : l.issues;
    const damageNotes = l.stains.length ? `Stains: ${l.stains.join(', ')}` : null;
    const hasDetails = l.color || issues.length || damageNotes;
    return {
      serviceCategoryId: l.serviceCategoryId,
      serviceItemId: l.serviceItemId,
      quantity: l.quantity,
      modifierIds: l.modifierIds,
      notes: l.notes || null,
      ...(hasDetails ? { garments: Array.from({ length: l.tags }, () => ({ color: l.color || null, issues, damageNotes })) } : {}),
    };
  });
}
