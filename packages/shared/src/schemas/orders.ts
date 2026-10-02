import { z } from 'zod';
import { DeliveryMode, DiscountType, GARMENT_ISSUES, ORDER_PAYMENT_STATUSES, ORDER_STATUSES, OrderStatus, PAYMENT_METHODS } from '../enums';
import {
  booleanQuery,
  dateOnlySchema,
  idSchema,
  isoDateTimeSchema,
  moneySchema,
  optionalText,
  paginationSchema,
  positiveMoneySchema,
  quantitySchema,
} from './common';

export const garmentDetailsSchema = z.object({
  color: optionalText(40),
  brand: optionalText(60),
  fabric: optionalText(60),
  issues: z.array(z.enum(GARMENT_ISSUES)).max(10).default([]),
  damageNotes: optionalText(500),
  specialInstructions: optionalText(500),
});
export type GarmentDetailsInput = z.infer<typeof garmentDetailsSchema>;

export const orderLineInputSchema = z.object({
  serviceCategoryId: idSchema,
  serviceItemId: idSchema,
  quantity: quantitySchema,
  modifierIds: z.array(idSchema).max(10).default([]),
  notes: optionalText(300),
  /** Optional per-garment details, applied in order to the generated tags. */
  garments: z.array(garmentDetailsSchema).max(200).optional(),
});
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

export const discountInputSchema = z
  .object({
    type: z.enum([DiscountType.PERCENT, DiscountType.FIXED]),
    value: moneySchema,
  })
  .refine((d) => d.type !== DiscountType.PERCENT || Number(d.value) <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['value'],
  });
export type DiscountInput = z.infer<typeof discountInputSchema>;

export const paymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: positiveMoneySchema,
  reference: optionalText(120),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const createOrderSchema = z.object({
  customerId: idSchema,
  storeId: idSchema,
  priceListId: idSchema.optional().nullable(),
  lines: z.array(orderLineInputSchema).min(1, 'Add at least one item').max(100),
  discount: discountInputSchema.optional().nullable(),
  dueDate: isoDateTimeSchema,
  deliveryMode: z.enum([DeliveryMode.STORE_PICKUP, DeliveryMode.HOME_DELIVERY]).default(DeliveryMode.STORE_PICKUP),
  deliveryAddressId: idSchema.optional().nullable(),
  notes: optionalText(1000),
  payments: z.array(paymentInputSchema).max(5).default([]),
  /** Pickup task this order was created from (pickup → order conversion). */
  pickupTaskId: idSchema.optional().nullable(),
  /** Client-generated key so double-submits never create duplicate orders. */
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  dueDate: isoDateTimeSchema.optional(),
  deliveryMode: z.enum([DeliveryMode.STORE_PICKUP, DeliveryMode.HOME_DELIVERY]).optional(),
  deliveryAddressId: idSchema.optional().nullable(),
  notes: optionalText(1000),
  discount: discountInputSchema.optional().nullable(),
  /** Replacing items is only allowed while the order is RECEIVED. */
  lines: z.array(orderLineInputSchema).min(1).max(100).optional(),
});
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const changeOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
  /** Managers may hand over an order that still has a balance (credit). */
  allowOutstanding: z.boolean().default(false),
});
export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason').max(500),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const ORDER_QUICK_FILTERS = ['today', 'due_today', 'overdue', 'ready', 'unpaid', 'open'] as const;
export type OrderQuickFilter = (typeof ORDER_QUICK_FILTERS)[number];

export const orderListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  /** Comma separated list of statuses, e.g. "RECEIVED,PROCESSING". */
  status: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.split(',').filter((s): s is OrderStatus => (ORDER_STATUSES as string[]).includes(s)) : undefined)),
  paymentStatus: z.enum(ORDER_PAYMENT_STATUSES).optional(),
  storeId: idSchema.optional(),
  customerId: idSchema.optional(),
  quick: z.enum(ORDER_QUICK_FILTERS).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  hasBalance: booleanQuery.optional(),
  sort: z.enum(['createdAt', 'dueDate', 'orderNumber', 'grandTotal', 'balanceDue', 'status']).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const pricePreviewSchema = z.object({
  priceListId: idSchema.optional().nullable(),
  storeId: idSchema.optional(),
  lines: z.array(orderLineInputSchema.pick({ serviceCategoryId: true, serviceItemId: true, quantity: true, modifierIds: true })).max(100),
  discount: discountInputSchema.optional().nullable(),
});
export type PricePreviewInput = z.infer<typeof pricePreviewSchema>;

export { moneySchema };
