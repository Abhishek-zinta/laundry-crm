'use client';

import { formatMoney, type MoneyInput } from '@rinseops/shared';
import { useMemo } from 'react';
import { useOptionalSession } from './session';

export interface Formatters {
  currency: string;
  timeZone: string;
  money: (value: MoneyInput | null | undefined) => string;
  date: (value: string | Date | null | undefined) => string;
  dateTime: (value: string | Date | null | undefined) => string;
  time: (value: string | Date | null | undefined) => string;
  shortDate: (value: string | Date | null | undefined) => string;
  /** YYYY-MM-DD calendar date (no timezone shift). */
  calendarDate: (key: string | null | undefined) => string;
  relative: (value: string | Date | null | undefined) => string;
}

export function createFormatters(currency = 'INR', locale = 'en-IN', timeZone = 'Asia/Kolkata'): Formatters {
  const d = new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short', year: 'numeric' });
  const sd = new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short' });
  const dt = new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const t = new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' });
  const cal = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v);
  const safe = (f: Intl.DateTimeFormat) => (v: string | Date | null | undefined) => (v ? f.format(toDate(v)) : '—');

  return {
    currency,
    timeZone,
    money: (v) => formatMoney(v ?? 0, currency, locale),
    date: safe(d),
    shortDate: safe(sd),
    dateTime: safe(dt),
    time: safe(t),
    calendarDate: (key) => (key ? cal.format(new Date(`${key}T00:00:00Z`)) : '—'),
    relative: (v) => {
      if (!v) return '—';
      const diff = toDate(v).getTime() - Date.now();
      const abs = Math.abs(diff);
      if (abs < 60_000) return 'just now';
      if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
      if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
      return rtf.format(Math.round(diff / 86_400_000), 'day');
    },
  };
}

/** Formatters bound to the current business's currency, locale and timezone. */
export function useFormat(): Formatters {
  const session = useOptionalSession();
  const s = session?.me.tenant.settings;
  return useMemo(() => createFormatters(s?.currency, s?.locale, s?.timezone), [s?.currency, s?.locale, s?.timezone]);
}
