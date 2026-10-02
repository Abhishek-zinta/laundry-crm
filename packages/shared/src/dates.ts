/**
 * Timezone helpers built on Intl only. The database stores UTC; "today",
 * "due today" and report ranges are always computed in the business timezone.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset (ms) of the zone from UTC at the given instant. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = timeZoneOffsetMs(new Date(guess), timeZone);
  let result = guess - offset;
  const offset2 = timeZoneOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

/** Calendar date (YYYY-MM-DD) of an instant in the zone. */
export function dateKeyInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

export function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** UTC instants bounding a calendar day in the zone: [start, end). */
export function zonedDayRange(key: string, timeZone: string): { start: Date; end: Date } {
  const { year, month, day } = parseDateKey(key);
  const next = parseDateKey(addDaysToKey(key, 1));
  return {
    start: zonedTimeToUtc(year, month, day, 0, 0, timeZone),
    end: zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone),
  };
}

/** UTC range covering whole calendar days fromKey..toKey (inclusive) in the zone. */
export function zonedRange(fromKey: string, toKey: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedDayRange(fromKey, timeZone).start,
    end: zonedDayRange(toKey, timeZone).end,
  };
}

export type RangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_30_days' | 'custom';

/** Resolves a preset into inclusive calendar-day keys in the zone. Weeks start on Monday. */
export function resolvePresetKeys(
  preset: RangePreset,
  timeZone: string,
  custom?: { from?: string; to?: string },
  now: Date = new Date(),
): { from: string; to: string } {
  const today = dateKeyInZone(now, timeZone);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysToKey(today, -1);
      return { from: y, to: y };
    }
    case 'this_week': {
      const { year, month, day } = parseDateKey(today);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
      const diff = (weekday + 6) % 7;
      return { from: addDaysToKey(today, -diff), to: today };
    }
    case 'this_month':
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'last_30_days':
      return { from: addDaysToKey(today, -29), to: today };
    case 'custom': {
      const from = custom?.from ?? today;
      const to = custom?.to ?? from;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** Lists each calendar day key between from and to (inclusive). */
export function eachDayKey(from: string, to: string, max = 400): string[] {
  const keys: string[] = [];
  let current = from;
  while (current <= to && keys.length < max) {
    keys.push(current);
    current = addDaysToKey(current, 1);
  }
  return keys;
}
