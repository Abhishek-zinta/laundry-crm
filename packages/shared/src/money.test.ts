import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, derivePaymentStatus, garmentUnitsForLine, moneyString, outstandingAmount, sumMoney } from './money';

describe('calculateOrderTotals', () => {
  const lines = [
    { unitPrice: '120.00', quantity: '3' }, // 3 shirts dry clean
    { unitPrice: '150.00', quantity: '2' }, // 2 trousers dry clean
    { unitPrice: '350.00', quantity: '1' }, // 1 blanket wash
  ];

  it('sums lines without tax or discount', () => {
    const r = calculateOrderTotals({ lines, taxRate: '0', taxInclusive: false });
    expect(r.subtotal).toBe('1010.00');
    expect(r.discountAmount).toBe('0.00');
    expect(r.taxAmount).toBe('0.00');
    expect(r.grandTotal).toBe('1010.00');
  });

  it('applies exclusive tax after a percentage discount', () => {
    const r = calculateOrderTotals({
      lines,
      discount: { type: 'PERCENT', value: '10' },
      taxRate: '18',
      taxInclusive: false,
    });
    expect(r.discountAmount).toBe('101.00');
    expect(r.taxableAmount).toBe('909.00');
    expect(r.taxAmount).toBe('163.62');
    expect(r.grandTotal).toBe('1072.62');
  });

  it('extracts inclusive tax without changing the total', () => {
    const r = calculateOrderTotals({ lines: [{ unitPrice: '118', quantity: 1 }], taxRate: '18', taxInclusive: true });
    expect(r.grandTotal).toBe('118.00');
    expect(r.taxableAmount).toBe('100.00');
    expect(r.taxAmount).toBe('18.00');
  });

  it('caps fixed discounts at the subtotal', () => {
    const r = calculateOrderTotals({
      lines: [{ unitPrice: '50', quantity: 1 }],
      discount: { type: 'FIXED', value: '80' },
      taxRate: '0',
      taxInclusive: false,
    });
    expect(r.discountAmount).toBe('50.00');
    expect(r.grandTotal).toBe('0.00');
  });

  it('applies percent and per-unit fixed modifiers', () => {
    const r = calculateOrderTotals({
      lines: [
        {
          unitPrice: '100',
          quantity: '2',
          modifiers: [
            { type: 'PERCENT', value: '50' }, // express +50% of 200 = 100
            { type: 'FIXED', value: '20' }, // stain treatment 20 x 2 = 40
          ],
        },
      ],
      taxRate: '0',
      taxInclusive: false,
    });
    expect(r.lines[0]).toEqual({ baseAmount: '200.00', modifiersAmount: '140.00', lineTotal: '340.00' });
    expect(r.grandTotal).toBe('340.00');
  });

  it('handles fractional kg quantities without float drift', () => {
    const r = calculateOrderTotals({ lines: [{ unitPrice: '89.90', quantity: '3.35' }], taxRate: '0', taxInclusive: false });
    expect(r.subtotal).toBe('301.17'); // 301.165 rounds half up
  });

  it('avoids classic floating point errors', () => {
    expect(sumMoney(['0.1', '0.2'])).toBe('0.30');
    expect(moneyString(1.005)).toBe('1.01');
  });
});

describe('payments', () => {
  it('derives payment status from the ledger', () => {
    expect(derivePaymentStatus('1000', '0')).toBe('UNPAID');
    expect(derivePaymentStatus('1000', '800')).toBe('PARTIAL');
    expect(derivePaymentStatus('1000', '1000')).toBe('PAID');
    expect(derivePaymentStatus('0', '0')).toBe('PAID');
  });

  it('calculates outstanding after partial payments', () => {
    const paid = sumMoney(['300', '500']);
    expect(outstandingAmount('1000', paid)).toBe('200.00');
  });
});

describe('garmentUnitsForLine', () => {
  it('generates one tag per piece, multiplied by pieces per unit', () => {
    expect(garmentUnitsForLine('PIECE', '3')).toBe(3);
    expect(garmentUnitsForLine('PIECE', '2', 2)).toBe(4);
    expect(garmentUnitsForLine('PAIR', '2')).toBe(2);
    expect(garmentUnitsForLine('KG', '4.5')).toBe(1);
  });
});
