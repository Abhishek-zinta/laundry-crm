'use client';

import { ORDER_STATUS_LABEL, type OrderStatus, type StatusHistoryDto } from '@rinseops/shared';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_DOT } from './status-badge';

/** Append-only status history rendered newest last, like a delivery tracker. */
export function OrderTimeline({ history }: { history: StatusHistoryDto[] }) {
  const f = useFormat();
  return (
    <ol className="relative">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        return (
          <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className="absolute top-4 left-[7px] h-full w-px bg-border" aria-hidden />}
            <span
              className={cn(
                'relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-[3px] border-card ring-1 ring-border',
                ORDER_STATUS_DOT[h.toStatus as OrderStatus],
                last && 'ring-2 ring-offset-0',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn('text-sm', last ? 'font-semibold' : 'font-medium')}>
                  {h.fromStatus ? ORDER_STATUS_LABEL[h.toStatus] : 'Order received'}
                </p>
                <time className="tabular text-xs text-muted-foreground" dateTime={h.changedAt}>
                  {f.dateTime(h.changedAt)}
                </time>
              </div>
              <p className="text-xs text-muted-foreground">
                {h.changedBy ? `by ${h.changedBy.name}` : 'System'}
                {h.fromStatus && ` · from ${ORDER_STATUS_LABEL[h.fromStatus]}`}
              </p>
              {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-foreground/80">{h.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
