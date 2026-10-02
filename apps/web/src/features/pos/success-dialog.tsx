'use client';

import type { OrderDetail } from '@rinseops/shared';
import { CheckCircle2, Eye, Plus, Printer, Tags } from 'lucide-react';
import Link from 'next/link';
import { MoneyDisplay } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** Shown right after an order is created: number, money summary and print actions. */
export function OrderSuccessDialog({ order, onNewOrder }: { order: OrderDetail | null; onNewOrder: () => void }) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(o) => !o && onNewOrder()}>
      <DialogContent size="sm" hideClose>
        {order && (
          <div className="p-5">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="size-10 text-emerald-600" />
              <DialogTitle className="mt-3 text-lg">Order created</DialogTitle>
              <DialogDescription className="mt-0.5">
                {order.customer.firstName} {order.customer.lastName ?? ''} · {order.totalPieces} garment tag
                {order.totalPieces === 1 ? '' : 's'}
              </DialogDescription>
              <p className="mt-3 rounded-lg bg-slate-100 px-4 py-2 font-mono text-xl font-semibold tracking-wide">{order.orderNumber}</p>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <dt className="text-[11px] text-muted-foreground">Total</dt>
                <dd className="text-sm font-semibold">
                  <MoneyDisplay value={order.grandTotal} />
                </dd>
              </div>
              <div className="rounded-lg border p-2">
                <dt className="text-[11px] text-muted-foreground">Paid</dt>
                <dd className="text-sm font-semibold text-emerald-700">
                  <MoneyDisplay value={order.paidAmount} />
                </dd>
              </div>
              <div className="rounded-lg border p-2">
                <dt className="text-[11px] text-muted-foreground">Balance</dt>
                <dd className="text-sm font-semibold">
                  <MoneyDisplay value={order.balanceDue} emphasizeDue />
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild variant="outline">
                <a href={`/print/receipt/${order.id}`} target="_blank" rel="noreferrer">
                  <Printer />
                  Receipt
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/print/tags/${order.id}`} target="_blank" rel="noreferrer">
                  <Tags />
                  Garment tags
                </a>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/orders/${order.id}`}>
                  <Eye />
                  View order
                </Link>
              </Button>
              <Button onClick={onNewOrder} autoFocus>
                <Plus />
                New order
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
