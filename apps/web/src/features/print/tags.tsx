'use client';

import { GARMENT_ISSUE_LABEL, type OrderDetail } from '@rinseops/shared';
import QRCode from 'react-qr-code';
import { ErrorState } from '@/components/shared/empty-state';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useOrder } from '../orders/api';
import { PrintToolbar, SegmentedLinks } from './print-toolbar';

export type TagLayout = 'sheet' | 'roll';

/**
 * Garment tags. "roll" prints one 50×30 mm tag per page for tag/label printers;
 * "sheet" lays tags out on A4 for cutting. The QR code encodes the tag code so
 * any scanner can type it into the search box.
 */
export function TagsPage({ id, layout }: { id: string; layout: TagLayout }) {
  const { data: order, error, refetch } = useOrder(id);
  return (
    <>
      <style>
        {layout === 'roll'
          ? '@page { size: 50mm 30mm; margin: 0; } @media print { .tag { break-after: page; } }'
          : '@page { size: A4; margin: 8mm; }'}
      </style>
      <PrintToolbar backHref={`/orders/${id}`}>
        <SegmentedLinks
          value={layout}
          options={[
            { value: 'roll', label: 'Tag printer 50×30', href: `/print/tags/${id}?layout=roll` },
            { value: 'sheet', label: 'A4 sheet', href: `/print/tags/${id}?layout=sheet` },
          ]}
        />
      </PrintToolbar>
      {!order ? (
        error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <p className="p-10 text-center text-sm text-muted-foreground">Preparing tags…</p>
        )
      ) : (
        <div
          className={cn(
            'mx-auto my-6 print:my-0',
            layout === 'sheet'
              ? 'grid w-[194mm] grid-cols-3 gap-[3mm] bg-white p-[4mm] shadow print:w-auto print:p-0 print:shadow-none'
              : 'grid w-[50mm] gap-3 print:gap-0',
          )}
        >
          {order.garments.map((g, i) => (
            <Tag key={g.id} order={order} garmentIndex={i} />
          ))}
        </div>
      )}
    </>
  );
}

function Tag({ order, garmentIndex }: { order: OrderDetail; garmentIndex: number }) {
  const f = useFormat();
  const { me } = useSession();
  const g = order.garments[garmentIndex]!;
  const line = order.lines.find((l) => l.id === g.orderLineId);
  return (
    <div className="tag flex h-[30mm] w-[50mm] gap-[2mm] overflow-hidden border border-dashed border-slate-400 bg-white p-[2mm] font-sans text-black print:border-solid print:border-slate-300">
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="truncate text-[6.5pt] font-semibold uppercase">{me.tenant.name}</p>
          <p className="font-mono text-[11pt] leading-tight font-bold">{g.tagCode}</p>
          <p className="truncate text-[7pt] font-medium">{line?.itemName}</p>
          <p className="truncate text-[6.5pt]">{line?.categoryName}</p>
        </div>
        <div className="min-w-0 text-[6.5pt] leading-tight">
          <p className="truncate">
            {order.orderNumber} · {garmentIndex + 1}/{order.garments.length}
          </p>
          <p className="truncate">
            {order.customer.firstName} · Due {f.shortDate(order.dueDate)}
          </p>
          {g.issues.length > 0 && <p className="truncate font-bold">⚠ {g.issues.map((i) => GARMENT_ISSUE_LABEL[i]).join(', ')}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <QRCode value={g.tagCode} size={64} style={{ width: '15mm', height: '15mm' }} level="M" />
      </div>
    </div>
  );
}
