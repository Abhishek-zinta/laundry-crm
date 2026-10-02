'use client';

import { Permission, toDecimal, type OrderDetail } from '@rinseops/shared';
import { AlertTriangle, Boxes, PackageCheck } from 'lucide-react';
import { MoneyDisplay } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/lib/session';

/**
 * Hand-over confirmation. With a balance outstanding, staff are steered to
 * collect payment; managers may deliver on credit.
 */
export function DeliverDialog({
  order,
  open,
  onOpenChange,
  onCollectPayment,
  onDeliver,
  loading,
}: {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCollectPayment: () => void;
  onDeliver: (allowOutstanding: boolean) => void;
  loading: boolean;
}) {
  const { can } = useSession();
  const owing = toDecimal(order.balanceDue).greaterThan(0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Hand over {order.orderNumber}?</DialogTitle>
          <DialogDescription>
            {order.totalPieces} garment{order.totalPieces === 1 ? '' : 's'} for {order.customer.firstName} {order.customer.lastName ?? ''}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          {order.rack && (
            <p className="flex items-center gap-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
              <Boxes className="size-4" />
              <span>
                Collect from{' '}
                <span className="font-semibold whitespace-nowrap">
                  {order.rack.rackName} → {order.rack.slotCode}
                </span>
                . The slot will be freed.
              </span>
            </p>
          )}
          {owing ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" />
                <MoneyDisplay value={order.balanceDue} /> still outstanding
              </p>
              <p className="mt-0.5 text-xs">Collect the balance before handing over the garments.</p>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <PackageCheck className="size-4" />
              Fully paid — ready to hand over.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {owing ? (
            <>
              {can(Permission.ORDERS_DELIVER_WITH_BALANCE) && (
                <Button variant="ghost" onClick={() => onDeliver(true)} loading={loading}>
                  Deliver on credit
                </Button>
              )}
              {can(Permission.PAYMENTS_CREATE) && <Button onClick={onCollectPayment}>Collect payment</Button>}
            </>
          ) : (
            <Button onClick={() => onDeliver(false)} loading={loading} autoFocus>
              Mark delivered
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
