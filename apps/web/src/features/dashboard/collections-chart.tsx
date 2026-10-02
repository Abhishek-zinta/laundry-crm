'use client';

import { useState } from 'react';
import { useFormat } from '@/lib/format';

/** Last-7-days collections: single series, one hue, hover tooltip, table view for screen readers. */
export function CollectionsChart({ data }: { data: Array<{ date: string; amount: string }> }) {
  const f = useFormat();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Number(d.amount)));
  const H = 120;

  return (
    <div>
      <div className="relative flex h-[150px] items-end gap-2 border-b border-slate-200 pt-6" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const h = Math.max(2, (Number(d.amount) / max) * H);
          const active = hover === i;
          return (
            <div
              key={d.date}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${f.calendarDate(d.date)}: ${f.money(d.amount)}`}
            >
              {active && (
                <div
                  className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
                  style={{ bottom: h + 4 }}
                >
                  {f.calendarDate(d.date)} · <span className="tabular font-medium">{f.money(d.amount)}</span>
                </div>
              )}
              <div
                className="w-full max-w-9 rounded-t-[4px] transition-colors"
                style={{ height: h, background: active || i === data.length - 1 ? '#0f766e' : '#5eada5' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-[11px] text-muted-foreground">
            {i === data.length - 1 ? 'Today' : f.calendarDate(d.date).split(' ')[0]?.replace(',', '')}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Payments collected per day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th>{d.date}</th>
              <td>{f.money(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
