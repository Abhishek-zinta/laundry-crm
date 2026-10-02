import type { RackRemovalReason } from '@rinseops/shared';
import type { TenantTx } from '../../common/prisma/tenant-extension';

/** Closes the order's current rack assignment (if any), freeing the slot. */
export async function releaseRack(
  tx: TenantTx,
  orderId: string,
  reason: RackRemovalReason,
  actorUserId: string | null,
): Promise<{ slotCode: string; rackName: string } | null> {
  const current = await tx.rackAssignment.findFirst({
    where: { orderId, removedAt: null },
    include: { rackSlot: { select: { code: true, rack: { select: { name: true } } } } },
  });
  if (!current) return null;
  await tx.rackAssignment.updateMany({
    where: { orderId, removedAt: null },
    data: { removedAt: new Date(), removedById: actorUserId, removalReason: reason },
  });
  return { slotCode: current.rackSlot.code, rackName: current.rackSlot.rack.name };
}
