import { z } from 'zod';
import { ORDER_STATUSES, OrderStatus } from '../enums';
import { idSchema, optionalText, paginationSchema } from './common';
import { garmentDetailsSchema } from './orders';

export const updateGarmentSchema = garmentDetailsSchema.partial();
export type UpdateGarmentInput = z.infer<typeof updateGarmentSchema>;

const garmentProcessingStatus = z.enum([OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.QUALITY_CHECK, OrderStatus.READY]);

export const changeGarmentStatusSchema = z.object({
  status: garmentProcessingStatus,
  note: optionalText(300),
});
export type ChangeGarmentStatusInput = z.infer<typeof changeGarmentStatusSchema>;

export const bulkGarmentStatusSchema = z.object({
  tagCodes: z.array(z.string().trim().min(1).max(40)).min(1).max(500),
  status: garmentProcessingStatus,
  note: optionalText(300),
});
export type BulkGarmentStatusInput = z.infer<typeof bulkGarmentStatusSchema>;

export const garmentListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  storeId: idSchema.optional(),
  orderId: idSchema.optional(),
  hasIssues: z.enum(['true', 'false']).optional(),
  /**
   * "due" (default): by order due date, oldest first.
   * "active": garments still in process first (most urgent first), then
   * delivered/cancelled ones, most recent first.
   */
  sort: z.enum(['due', 'active']).default('due'),
});
export type GarmentListQuery = z.infer<typeof garmentListQuerySchema>;
