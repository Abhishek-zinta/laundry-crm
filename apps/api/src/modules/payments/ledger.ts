import { derivePaymentStatus, outstandingAmount, sumMoney } from '@rinseops/shared';
import type { TenantTx } from '../../common/prisma/tenant-extension';
import { money } from '../../common/util/serialize';

/**
 * Locks the order row for the rest of the transaction so concurrent
 * payments / status changes on the same order are serialised.
 */
export async function lockOrder(tx: TenantTx, tenantId: string, orderId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Order" WHERE id = ${orderId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Recomputes the cached payment fields of an order from the payment ledger.
 * paidAmount/balanceDue/paymentStatus are caches — the ledger is the truth.
 */
export async function recalcOrderPayments(tx: TenantTx, orderId: string) {
  const [order, completed] = await Promise.all([
    tx.order.findFirstOrThrow({ where: { id: orderId }, select: { grandTotal: true } }),
    tx.payment.findMany({ where: { orderId, status: 'COMPLETED' }, select: { amount: true } }),
  ]);
  const paid = sumMoney(completed.map((p) => p.amount.toString()));
  const grandTotal = money(order.grandTotal);
  const balance = outstandingAmount(grandTotal, paid);
  return tx.order.update({
    where: { id: orderId },
    data: {
      paidAmount: paid,
      balanceDue: balance,
      paymentStatus: derivePaymentStatus(grandTotal, paid),
    },
    select: { paidAmount: true, balanceDue: true, paymentStatus: true, grandTotal: true },
  });
}
