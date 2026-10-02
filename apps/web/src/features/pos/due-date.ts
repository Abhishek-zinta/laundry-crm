import { addDaysToKey, dateKeyInZone, parseDateKey, timeZoneOffsetMs, zonedTimeToUtc } from '@rinseops/shared';

const READY_HOUR = 18;

/** Due date at 6 pm (business time) `days` from today. */
export function dueAtDays(days: number, timeZone: string, now = new Date()): Date {
  const key = addDaysToKey(dateKeyInZone(now, timeZone), days);
  const { year, month, day } = parseDateKey(key);
  return zonedTimeToUtc(year, month, day, READY_HOUR, 0, timeZone);
}

/** Default due date from the business turnaround setting. */
export function defaultDueDate(turnaroundHours: number, timeZone: string, now = new Date()): Date {
  if (turnaroundHours < 24) {
    const d = new Date(now.getTime() + turnaroundHours * 3_600_000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() + 3_600_000);
  }
  return dueAtDays(Math.ceil(turnaroundHours / 24), timeZone, now);
}

/** UTC → value for <input type="datetime-local"> in the business timezone. */
export function toLocalInput(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + timeZoneOffsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (business timezone) → UTC Date. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), timeZone);
}

export const DUE_PRESETS = [
  { label: 'Tomorrow', days: 1 },
  { label: '2 days', days: 2 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
];
