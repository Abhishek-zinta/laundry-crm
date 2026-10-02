import { z } from 'zod';
import { emailSchema, idSchema, optionalPhoneSchema, optionalText, percentSchema } from './common';

const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(8)
  .regex(/^[A-Z]+$/, 'Use letters only');

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z
    .union([z.literal(''), z.url()])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  phone: optionalPhoneSchema,
  email: z
    .union([z.literal(''), emailSchema])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  address: optionalText(400),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0f766e')
    .optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  taxName: z.string().trim().min(1).max(20).optional(),
  taxRate: percentSchema.optional(),
  taxInclusive: z.boolean().optional(),
  taxNumber: optionalText(40),
  orderPrefix: prefix.optional(),
  invoicePrefix: prefix.optional(),
  garmentPrefix: prefix.optional(),
  receiptFooter: optionalText(300),
  defaultTurnaroundHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .optional(),
  skipQualityCheck: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  timeSlots: z.array(z.string().trim().min(3).max(40)).min(1).max(24).optional(),
  defaultPriceListId: idSchema.optional().nullable(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(8)
    .regex(/^[A-Z0-9]+$/, 'Use letters and numbers only'),
  phone: optionalPhoneSchema,
  address: optionalText(400),
  isActive: z.boolean().default(true),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export const updateStoreSchema = createStoreSchema.partial();
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
