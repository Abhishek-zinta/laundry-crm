import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../enums';
import { dateOnlySchema, idSchema, optionalText, paginationSchema, positiveMoneySchema } from './common';

export const createPaymentSchema = z.object({
  orderId: idSchema,
  amount: positiveMoneySchema,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  notes: optionalText(500),
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason').max(500),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const paymentListQuerySchema = paginationSchema.extend({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  storeId: idSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
