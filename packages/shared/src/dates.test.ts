import { describe, expect, it } from 'vitest';
import { dateKeyInZone, resolvePresetKeys, zonedDayRange } from './dates';
import { classifySearch, formatOrderNumber, formatTagCode, normalizePhone } from './identifiers';

describe('timezone helpers', () => {
  it('computes day boundaries in IST', () => {
    const { start, end } = zonedDayRange('2026-10-02', 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-10-01T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-02T18:30:00.000Z');
  });

  it('handles DST zones', () => {
    const { start, end } = zonedDayRange('2026-03-08', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('derives the local calendar date', () => {
    expect(dateKeyInZone(new Date('2026-10-01T19:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-02');
  });

  it('resolves presets with Monday week start', () => {
    const now = new Date('2026-10-02T06:00:00Z'); // Friday
    expect(resolvePresetKeys('this_week', 'Asia/Kolkata', undefined, now)).toEqual({ from: '2026-09-28', to: '2026-10-02' });
    expect(resolvePresetKeys('yesterday', 'Asia/Kolkata', undefined, now)).toEqual({ from: '2026-10-01', to: '2026-10-01' });
    expect(resolvePresetKeys('this_month', 'Asia/Kolkata', undefined, now)).toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });
});

describe('identifiers', () => {
  it('formats order numbers and tags', () => {
    expect(formatOrderNumber('RO', 2026, 42)).toBe('RO-2026-000042');
    expect(formatTagCode('GAR', 298)).toBe('GAR-000298');
  });

  it('normalises phones', () => {
    expect(normalizePhone(' +91 98765-43210 ')).toBe('+919876543210');
    expect(normalizePhone('(987) 654 3210')).toBe('9876543210');
  });

  it('classifies searches', () => {
    expect(classifySearch('RO-2026-000042')).toBe('order');
    expect(classifySearch('GAR-000298')).toBe('tag');
    expect(classifySearch('9876543210')).toBe('phone');
    expect(classifySearch('Priya')).toBe('text');
  });
});
