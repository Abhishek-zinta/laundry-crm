import Decimal from 'decimal.js';
import { DiscountType, ModifierType, OrderPaymentStatus, UnitType } from './enums';

/**
 * All money is handled as decimal strings with 2 fraction digits ("1250.00").
 * Never use JS floating point arithmetic for money — always go through Decimal.
 */
export type MoneyInput = string | number | Decimal;

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: MoneyInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return new Money(0);
  return new Money(value instanceof Decimal ? value.toString() : value);
}

export function roundMoney(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Canonical string form, e.g. "120.00". */
export function moneyString(value: MoneyInput | null | undefined): string {
  return roundMoney(value ?? 0).toFixed(2);
}

export function sumMoney(values: Array<MoneyInput | null | undefined>): string {
  return moneyString(values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Money(0)));
}

export function isPositiveMoney(value: MoneyInput): boolean {
  return toDecimal(value).greaterThan(0);
}

export interface PricingModifierInput {
  type: ModifierType;
  /** Percent (e.g. "50" for +50%) or fixed amount per unit. */
  value: MoneyInput;
}

export interface PricingLineInput {
  unitPrice: MoneyInput;
  quantity: MoneyInput;
  modifiers?: PricingModifierInput[];
}

export interface PricingDiscountInput {
  type: DiscountType;
  value: MoneyInput;
}

export interface PricingInput {
  lines: PricingLineInput[];
  discount?: PricingDiscountInput | null;
  /** Tax rate in percent, e.g. "18" */
  taxRate: MoneyInput;
  /** When true, prices already include tax. */
  taxInclusive: boolean;
}

export interface PricedLine {
  baseAmount: string;
  modifiersAmount: string;
  lineTotal: string;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  grandTotal: string;
}

export function priceModifier(modifier: PricingModifierInput, baseAmount: Decimal, quantity: Decimal): Decimal {
  const value = toDecimal(modifier.value);
  if (modifier.type === ModifierType.PERCENT) {
    return roundMoney(baseAmount.times(value).dividedBy(100));
  }
  return roundMoney(value.times(quantity));
}

export function priceLine(line: PricingLineInput): PricedLine {
  const quantity = toDecimal(line.quantity);
  const base = roundMoney(toDecimal(line.unitPrice).times(quantity));
  const modifiers = (line.modifiers ?? []).reduce<Decimal>((acc, m) => acc.plus(priceModifier(m, base, quantity)), new Money(0));
  return {
    baseAmount: moneyString(base),
    modifiersAmount: moneyString(modifiers),
    lineTotal: moneyString(base.plus(modifiers)),
  };
}

export function calculateDiscount(subtotal: Decimal, discount?: PricingDiscountInput | null): Decimal {
  if (!discount) return new Money(0);
  const value = toDecimal(discount.value);
  if (value.lessThanOrEqualTo(0)) return new Money(0);
  const raw = discount.type === DiscountType.PERCENT ? subtotal.times(Decimal.min(value, 100)).dividedBy(100) : value;
  return roundMoney(Decimal.min(raw, subtotal));
}

/**
 * Single source of truth for order totals. Used by the API when persisting
 * orders and by the POS to preview totals — the API result always wins.
 */
export function calculateOrderTotals(input: PricingInput): PricingResult {
  const lines = input.lines.map(priceLine);
  const subtotal = lines.reduce<Decimal>((acc, l) => acc.plus(l.lineTotal), new Money(0));
  const discountAmount = calculateDiscount(subtotal, input.discount);
  const afterDiscount = subtotal.minus(discountAmount);
  const rate = toDecimal(input.taxRate);

  let taxAmount: Decimal;
  let grandTotal: Decimal;
  let taxableAmount: Decimal;
  if (rate.lessThanOrEqualTo(0)) {
    taxAmount = new Money(0);
    taxableAmount = afterDiscount;
    grandTotal = afterDiscount;
  } else if (input.taxInclusive) {
    grandTotal = afterDiscount;
    taxableAmount = roundMoney(afterDiscount.times(100).dividedBy(rate.plus(100)));
    taxAmount = grandTotal.minus(taxableAmount);
  } else {
    taxableAmount = afterDiscount;
    taxAmount = roundMoney(afterDiscount.times(rate).dividedBy(100));
    grandTotal = afterDiscount.plus(taxAmount);
  }

  return {
    lines,
    subtotal: moneyString(subtotal),
    discountAmount: moneyString(discountAmount),
    taxableAmount: moneyString(taxableAmount),
    taxAmount: moneyString(taxAmount),
    grandTotal: moneyString(grandTotal),
  };
}

export function derivePaymentStatus(grandTotal: MoneyInput, paidAmount: MoneyInput): OrderPaymentStatus {
  const total = toDecimal(grandTotal);
  const paid = toDecimal(paidAmount);
  if (paid.greaterThanOrEqualTo(total)) return OrderPaymentStatus.PAID;
  if (paid.greaterThan(0)) return OrderPaymentStatus.PARTIAL;
  return OrderPaymentStatus.UNPAID;
}

export function outstandingAmount(grandTotal: MoneyInput, paidAmount: MoneyInput): string {
  return moneyString(toDecimal(grandTotal).minus(toDecimal(paidAmount)));
}

/** Number of physical garment tags to generate for an order line. */
export function garmentUnitsForLine(unitType: UnitType, quantity: MoneyInput, piecesPerUnit = 1): number {
  if (unitType === UnitType.KG) return 1; // one bag tag per weighed line
  const qty = Math.ceil(toDecimal(quantity).toNumber());
  return Math.max(1, qty * Math.max(1, piecesPerUnit));
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: MoneyInput | null | undefined, currency = 'INR', locale = 'en-IN'): string {
  const key = `${locale}:${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatterCache.set(key, formatter);
  }
  // Intl accepts numeric strings; using the string avoids float conversion.
  return formatter.format(moneyString(value ?? 0) as unknown as number);
}

export { Decimal };
