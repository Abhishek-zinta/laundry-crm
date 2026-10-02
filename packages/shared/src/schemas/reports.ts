import { z } from 'zod';
import { dateOnlySchema, idSchema } from './common';

export const REPORT_TYPES = ['sales', 'orders', 'payments', 'outstanding', 'services', 'customers'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const DATE_PRESETS = ['today', 'yesterday', 'this_week', 'this_month', 'last_30_days', 'custom'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const reportQuerySchema = z.object({
  preset: z.enum(DATE_PRESETS).default('this_month'),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  storeId: idSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const dashboardQuerySchema = z.object({
  storeId: idSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const auditListQuerySchema = z.object({
  entityType: z.string().trim().max(40).optional(),
  entityId: idSchema.optional(),
  actorUserId: idSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
