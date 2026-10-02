import { Prisma } from '@prisma/client';
import { garmentIconFor } from '@rinseops/shared';
import { money, optionalMoney } from '../../common/util/serialize';

export const ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  grandTotal: true,
  paidAmount: true,
  balanceDue: true,
  totalPieces: true,
  dueDate: true,
  createdAt: true,
  deliveryMode: true,
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  store: { select: { id: true, name: true, code: true } },
  rackAssignments: {
    where: { removedAt: null },
    select: { rackSlot: { select: { id: true, code: true, rack: { select: { id: true, name: true, code: true } } } } },
  },
} satisfies Prisma.OrderSelect;

export type OrderListRow = Prisma.OrderGetPayload<{ select: typeof ORDER_LIST_SELECT }>;

export function serializeOrderListRow(o: OrderListRow) {
  const { rackAssignments, ...rest } = o;
  return {
    ...rest,
    grandTotal: money(o.grandTotal),
    paidAmount: money(o.paidAmount),
    balanceDue: money(o.balanceDue),
    rack: rackLocation(rackAssignments[0]?.rackSlot),
  };
}

export function rackLocation(slot?: { id: string; code: string; rack: { id: string; name: string; code: string } } | null) {
  if (!slot) return null;
  return { slotId: slot.id, slotCode: slot.code, rackId: slot.rack.id, rackName: slot.rack.name, rackCode: slot.rack.code };
}

const userName = { select: { id: true, name: true } } as const;

export const ORDER_DETAIL_INCLUDE = {
  customer: {
    select: { id: true, firstName: true, lastName: true, phone: true, alternatePhone: true, email: true, notes: true },
  },
  store: { select: { id: true, name: true, code: true, phone: true, address: true } },
  priceList: { select: { id: true, name: true } },
  deliveryAddress: true,
  createdBy: userName,
  lines: { orderBy: { position: 'asc' }, include: { modifiers: true, serviceItem: { select: { icon: true } } } },
  garments: { orderBy: { tagCode: 'asc' } },
  statusHistory: { orderBy: { changedAt: 'asc' }, include: { changedBy: userName } },
  payments: {
    orderBy: { receivedAt: 'asc' },
    include: { receivedBy: userName, refundedBy: userName },
  },
  rackAssignments: {
    orderBy: { assignedAt: 'desc' },
    include: {
      rackSlot: { select: { id: true, code: true, rack: { select: { id: true, name: true, code: true } } } },
      assignedBy: userName,
      removedBy: userName,
    },
  },
  tasks: {
    orderBy: { scheduledDate: 'desc' },
    include: { assignedDriver: { select: { id: true, name: true, phone: true } } },
  },
} satisfies Prisma.OrderInclude;

export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export function serializeOrderDetail(o: OrderDetailRow) {
  const current = o.rackAssignments.find((a) => !a.removedAt);
  return {
    ...o,
    subtotal: money(o.subtotal),
    discountValue: optionalMoney(o.discountValue),
    discountAmount: money(o.discountAmount),
    taxRate: money(o.taxRate),
    taxAmount: money(o.taxAmount),
    grandTotal: money(o.grandTotal),
    paidAmount: money(o.paidAmount),
    balanceDue: money(o.balanceDue),
    lines: o.lines.map(({ serviceItem, ...l }) => ({
      ...l,
      icon: garmentIconFor(l.itemName, serviceItem.icon),
      quantity: l.quantity.toString(),
      unitPrice: money(l.unitPrice),
      modifiersAmount: money(l.modifiersAmount),
      lineTotal: money(l.lineTotal),
      modifiers: l.modifiers.map((m) => ({ ...m, value: money(m.value), amount: money(m.amount) })),
    })),
    payments: o.payments.map((p) => ({ ...p, amount: money(p.amount) })),
    rack: rackLocation(current?.rackSlot),
    rackHistory: o.rackAssignments.map((a) => ({
      id: a.id,
      slotCode: a.rackSlot.code,
      rackName: a.rackSlot.rack.name,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
      removedAt: a.removedAt,
      removedBy: a.removedBy,
      removalReason: a.removalReason,
    })),
    rackAssignments: undefined,
    tasks: o.tasks.map((t) => ({ ...t, scheduledDate: t.scheduledDate.toISOString().slice(0, 10) })),
  };
}
