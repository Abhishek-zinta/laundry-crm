import type { ReportColumnType } from '@rinseops/shared';
import type { Formatters } from '@/lib/format';

/** Formats a report value according to its column type. */
export function formatReportValue(value: string | number | null | undefined, type: ReportColumnType, f: Formatters): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return f.money(value);
    case 'datetime':
      return f.dateTime(String(value));
    case 'date':
      return f.calendarDate(String(value));
    case 'percent':
      return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}
