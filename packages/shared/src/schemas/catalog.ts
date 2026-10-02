import { z } from 'zod';
import { ModifierType, UNIT_TYPES } from '../enums';
import { GARMENT_ICON_KEYS, type GarmentIconKey } from '../garment-icons';
import { idSchema, moneySchema, optionalText } from './common';

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(12)
    .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - or _'),
  description: optionalText(300),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
export const updateServiceCategorySchema = createServiceCategorySchema.partial();
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;

export const createServiceItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  unitType: z.enum(UNIT_TYPES),
  /** Physical tags generated per unit (e.g. a 2-piece suit = 2). */
  piecesPerUnit: z.coerce.number().int().min(1).max(20).default(1),
  icon: z.enum(GARMENT_ICON_KEYS as [GarmentIconKey, ...GarmentIconKey[]]).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export type CreateServiceItemInput = z.infer<typeof createServiceItemSchema>;
export const updateServiceItemSchema = createServiceItemSchema.partial();
export type UpdateServiceItemInput = z.infer<typeof updateServiceItemSchema>;

export const createPriceListSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalText(300),
  storeId: idSchema.optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  /** Copy all prices from another list when creating. */
  copyFromPriceListId: idSchema.optional(),
});
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export const updatePriceListSchema = createPriceListSchema.omit({ copyFromPriceListId: true }).partial();
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;

export const upsertPriceListItemsSchema = z.object({
  items: z
    .array(
      z.object({
        serviceCategoryId: idSchema,
        serviceItemId: idSchema,
        price: moneySchema,
        isActive: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(1000),
});
export type UpsertPriceListItemsInput = z.infer<typeof upsertPriceListItemsSchema>;

export const createModifierSchema = z.object({
  name: z.string().trim().min(2).max(60),
  type: z.enum([ModifierType.PERCENT, ModifierType.FIXED]),
  value: moneySchema,
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export type CreateModifierInput = z.infer<typeof createModifierSchema>;
export const updateModifierSchema = createModifierSchema.partial();
export type UpdateModifierInput = z.infer<typeof updateModifierSchema>;
