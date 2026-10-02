'use client';

import { useFormat } from '@/lib/format';

interface Point {
  date: string;
  value: number;
}

/**
 * Single-series column chart of a daily amount. One teal hue (no legend needed —
 * the card title names the series), thin columns with rounded data-ends, a
 * recessive grid, and a hover tooltip per column. The report table below is the
 * accessible table view.
 */
export function DailyBarChart({ points, label }: { points: Point[]; label: string }) {
  const f = useFormat();
  const max = Math.max(0, ...points.map((p) => p.value));
  const niceMax = max > 0 ? niceCeil(max) : 1;
  const ticks = [niceMax, niceMax / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const peak = points.reduce<Point | null>((best, p) => (!best || p.value > best.value ? p : best), null);

  if (points.length < 2) return null;

  return (
    <figure className="w-full" aria-label={`${label} by day`}>
      <div className="flex gap-2">
        <div className="relative w-14 shrink-0 text-right text-[11px] text-muted-foreground" aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="tabular absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative h-48 min-w-0 flex-1">
          {ticks.map((t, i) => (
            <div
              key={t}
              className={
                i === ticks.length - 1
                  ? 'absolute inset-x-0 border-t border-slate-300'
                  : 'absolute inset-x-0 border-t border-dashed border-slate-200'
              }
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              aria-hidden
            />
          ))}
          <ul className="absolute inset-0 flex items-end gap-[2px]">
            {points.map((p) => {
              const h = (p.value / niceMax) * 100;
              const text = `${f.calendarDate(p.date)}: ${f.money(p.value)}`;
              return (
                <li key={p.date} className="group relative flex h-full flex-1 items-end justify-center" title={text}>
                  <span className="sr-only">{text}</span>
                  <span
                    className="w-full max-w-6 rounded-t-[4px] bg-teal-600 transition-colors group-hover:bg-teal-800"
                    style={{ height: `${Math.max(h, p.value > 0 ? 1 : 0)}%` }}
                  />
                  {peak && p.date === peak.date && peak.value > 0 && (
                    <span
                      className="tabular pointer-events-none absolute -translate-y-full pb-0.5 text-[10px] font-medium text-foreground/80 group-hover:hidden"
                      style={{ bottom: `${h}%` }}
                    >
                      {compact(p.value)}
                    </span>
                  )}
                  <span
                    className="pointer-events-none absolute z-10 hidden -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-[11px] whitespace-nowrap text-white shadow-md group-hover:block"
                    style={{ bottom: `calc(${h}% + 4px)` }}
                  >
                    {text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="mt-1.5 flex gap-[2px] pl-16 text-[10px] text-muted-foreground" aria-hidden>
        {points.map((p, i) => (
          <span key={p.date} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? f.calendarDate(p.date).replace(/^\w+,?\s*/, '') : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

function niceCeil(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

function compact(v: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}
