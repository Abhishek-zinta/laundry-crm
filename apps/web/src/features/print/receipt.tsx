'use client';

import { customerDisplayName, PAYMENT_METHOD_LABEL, UNIT_TYPE_SHORT, type OrderDetail } from '@rinseops/shared';
import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/empty-state';
import { errorMessage } from '@/lib/api-client';
import { useFormat } from '@/lib/format';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useOrder } from '../orders/api';
import { PrintToolbar, SegmentedLinks } from './print-toolbar';

export type ReceiptFormat = 'thermal' | 'a4';

export function ReceiptPage({ id, format, autoPrint }: { id: string; format: ReceiptFormat; autoPrint: boolean }) {
  const { data: order, error, refetch } = useOrder(id);

  useEffect(() => {
    if (order && autoPrint) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [order, autoPrint]);

  return (
    <>
      <style>{format === 'thermal' ? '@page { size: 80mm auto; margin: 0; }' : '@page { size: A4; margin: 12mm; }'}</style>
      <PrintToolbar backHref={`/orders/${id}`}>
        <SegmentedLinks
          value={format}
          options={[
            { value: 'thermal', label: '80mm receipt', href: `/print/receipt/${id}?format=thermal` },
            { value: 'a4', label: 'A4 invoice', href: `/print/receipt/${id}?format=a4` },
          ]}
        />
      </PrintToolbar>
      {!order ? (
        error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <p className="p-10 text-center text-sm text-muted-foreground">Preparing receipt…</p>
        )
      ) : format === 'thermal' ? (
        <ThermalReceipt order={order} />
      ) : (
        <A4Invoice order={order} />
      )}
    </>
  );
}

function useInvoiceNumber(order: OrderDetail) {
  const { me } = useSession();
  const prefix = me.tenant.settings.invoicePrefix;
  const suffix = order.orderNumber.split('-').slice(1).join('-');
  return `${prefix}-${suffix || order.orderNumber}`;
}

function ThermalReceipt({ order }: { order: OrderDetail }) {
  const f = useFormat();
  const { me } = useSession();
  const t = me.tenant;
  const completed = order.payments.filter((p) => p.status === 'COMPLETED');
  const line = 'border-t border-dashed border-slate-400 my-2';

  return (
    <div className="mx-auto my-6 w-[80mm] bg-white px-[4mm] py-[5mm] font-mono text-[11.5px] leading-snug text-black shadow print:my-0 print:shadow-none">
      <div className="text-center">
        {t.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" className="mx-auto mb-1 max-h-12 grayscale" />
        )}
        <p className="text-[15px] font-bold">{t.name}</p>
        <p>{order.store.name}</p>
        {order.store.address && <p>{order.store.address}</p>}
        {(order.store.phone ?? t.phone) && <p>Tel: {order.store.phone ?? t.phone}</p>}
        {t.settings.taxNumber && (
          <p>
            {t.settings.taxName} No: {t.settings.taxNumber}
          </p>
        )}
      </div>
      <div className={line} />
      <p className="text-center text-[16px] font-bold tracking-wide">{order.orderNumber}</p>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
        <span>Customer</span>
        <span className="text-right">{customerDisplayName(order.customer)}</span>
        <span>Phone</span>
        <span className="text-right">{order.customer.phone}</span>
        <span>Date</span>
        <span className="text-right">{f.dateTime(order.createdAt)}</span>
        <span className="font-bold">Due</span>
        <span className="text-right font-bold">{f.dateTime(order.dueDate)}</span>
        <span>Pieces</span>
        <span className="text-right">{order.totalPieces}</span>
      </div>
      <div className={line} />
      <div className="grid grid-cols-[1fr_auto] gap-x-2">
        {order.lines.map((l) => (
          <div key={l.id} className="contents">
            <div>
              <p className="font-semibold">{l.itemName}</p>
              <p className="text-[10.5px]">
                {l.categoryName} · {Number(l.quantity)} {UNIT_TYPE_SHORT[l.unitType]} × {f.money(l.unitPrice)}
                {l.modifiers.map((m) => ` +${m.name}`)}
              </p>
            </div>
            <p className="text-right">{f.money(l.lineTotal)}</p>
          </div>
        ))}
      </div>
      <div className={line} />
      <Totals order={order} compact />
      {completed.length > 0 && (
        <>
          <div className={line} />
          {completed.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>
                Paid · {PAYMENT_METHOD_LABEL[p.method]} {f.shortDate(p.receivedAt)}
              </span>
              <span>{f.money(p.amount)}</span>
            </div>
          ))}
        </>
      )}
      <div className={line} />
      <div className="flex justify-between text-[14px] font-bold">
        <span>BALANCE</span>
        <span>{f.money(order.balanceDue)}</span>
      </div>
      {order.notes && <p className="mt-2 text-[10.5px]">Note: {order.notes}</p>}
      <div className={line} />
      <p className="text-center">{t.settings.receiptFooter ?? 'Thank you!'}</p>
      <p className="mt-1 text-center text-[10px]">Please bring this receipt when collecting.</p>
    </div>
  );
}

function A4Invoice({ order }: { order: OrderDetail }) {
  const f = useFormat();
  const { me } = useSession();
  const t = me.tenant;
  const invoiceNumber = useInvoiceNumber(order);
  const completed = order.payments.filter((p) => p.status === 'COMPLETED');

  return (
    <div className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[14mm] text-[12.5px] text-slate-900 shadow print:my-0 print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b pb-5">
        <div className="flex items-start gap-3">
          {t.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.logoUrl} alt="" className="max-h-14 max-w-32 object-contain" />
          ) : (
            <span
              className="grid size-12 place-items-center rounded-lg text-xl font-bold text-white"
              style={{ background: t.settings.brandColor }}
            >
              {t.name[0]}
            </span>
          )}
          <div>
            <p className="text-lg font-bold">{t.name}</p>
            <p className="text-slate-600">{order.store.name}</p>
            {(order.store.address ?? t.address) && <p className="max-w-xs text-slate-600">{order.store.address ?? t.address}</p>}
            <p className="text-slate-600">{[order.store.phone ?? t.phone, t.email].filter(Boolean).join(' · ')}</p>
            {t.settings.taxNumber && (
              <p className="text-slate-600">
                {t.settings.taxName} No: {t.settings.taxNumber}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-tight" style={{ color: t.settings.brandColor }}>
            {Number(order.taxRate) > 0 ? 'Tax Invoice' : 'Invoice'}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5">
            <dt className="text-slate-500">Invoice #</dt>
            <dd className="font-medium">{invoiceNumber}</dd>
            <dt className="text-slate-500">Order #</dt>
            <dd className="font-mono font-medium">{order.orderNumber}</dd>
            <dt className="text-slate-500">Order date</dt>
            <dd>{f.date(order.createdAt)}</dd>
            <dt className="text-slate-500">Due date</dt>
            <dd>{f.dateTime(order.dueDate)}</dd>
          </dl>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-5">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Bill to</p>
          <p className="mt-1 font-semibold">{customerDisplayName(order.customer)}</p>
          <p>{order.customer.phone}</p>
          {order.customer.email && <p>{order.customer.email}</p>}
          {order.deliveryAddress && (
            <p className="text-slate-600">
              {[
                order.deliveryAddress.addressLine1,
                order.deliveryAddress.addressLine2,
                order.deliveryAddress.city,
                order.deliveryAddress.postalCode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Amount due</p>
          <p className="mt-1 text-2xl font-semibold">{f.money(order.balanceDue)}</p>
          <p className="text-slate-600">{order.totalPieces} garments</p>
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y bg-slate-50 text-left text-[11px] tracking-wide text-slate-500 uppercase">
            <th className="px-2 py-2 font-semibold">Description</th>
            <th className="px-2 py-2 text-right font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Rate</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id} className="border-b align-top">
              <td className="px-2 py-2">
                <p className="font-medium">{l.itemName}</p>
                <p className="text-slate-500">
                  {l.categoryName}
                  {l.modifiers.map((m) => ` · ${m.name}`)}
                </p>
              </td>
              <td className="tabular px-2 py-2 text-right">
                {Number(l.quantity)} {UNIT_TYPE_SHORT[l.unitType]}
              </td>
              <td className="tabular px-2 py-2 text-right">{f.money(l.unitPrice)}</td>
              <td className="tabular px-2 py-2 text-right">{f.money(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-72">
          <Totals order={order} />
        </div>
      </div>

      {completed.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Payments received</p>
          <table className="mt-1 w-full">
            <tbody>
              {completed.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1.5">{f.dateTime(p.receivedAt)}</td>
                  <td className="py-1.5">{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td className="py-1.5 text-slate-500">{p.reference ?? ''}</td>
                  <td className="tabular py-1.5 text-right">{f.money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {order.notes && <p className="mt-6 rounded bg-slate-50 p-3 text-slate-700">Notes: {order.notes}</p>}
      <footer className="mt-10 border-t pt-4 text-center text-slate-500">
        <p>{t.settings.receiptFooter ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}

function Totals({ order, compact }: { order: OrderDetail; compact?: boolean }) {
  const f = useFormat();
  const row = cn('flex justify-between', !compact && 'py-0.5');
  return (
    <div className={cn(!compact && 'grid gap-0.5')}>
      <div className={row}>
        <span>Subtotal</span>
        <span>{f.money(order.subtotal)}</span>
      </div>
      {Number(order.discountAmount) > 0 && (
        <div className={row}>
          <span>Discount{order.discountType === 'PERCENT' ? ` (${Number(order.discountValue)}%)` : ''}</span>
          <span>− {f.money(order.discountAmount)}</span>
        </div>
      )}
      {Number(order.taxRate) > 0 && (
        <div className={row}>
          <span>
            {order.taxName ?? 'Tax'} {Number(order.taxRate)}%{order.taxInclusive ? ' (incl.)' : ''}
          </span>
          <span>{f.money(order.taxAmount)}</span>
        </div>
      )}
      <div className={cn(row, 'font-bold', compact ? 'text-[13px]' : 'border-t pt-1.5 text-[14px]')}>
        <span>Total</span>
        <span>{f.money(order.grandTotal)}</span>
      </div>
      <div className={row}>
        <span>Paid</span>
        <span>{f.money(order.paidAmount)}</span>
      </div>
      {!compact && (
        <div className={cn(row, 'font-semibold')}>
          <span>Balance</span>
          <span>{f.money(order.balanceDue)}</span>
        </div>
      )}
    </div>
  );
}
