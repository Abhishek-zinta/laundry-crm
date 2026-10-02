import { z } from 'zod';
import { idSchema, optionalText } from './common';

export const createRackSchema = z.object({
  storeId: idSchema,
  name: z.string().trim().min(1).max(40),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(6)
    .regex(/^[A-Z0-9]+$/, 'Use letters and numbers only'),
  description: optionalText(200),
  /** Number of slots to create automatically (A01…A{n}). */
  slotCount: z.coerce.number().int().min(0).max(200).default(10),
  slotCapacity: z.coerce.number().int().min(1).max(100).default(1),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type CreateRackInput = z.infer<typeof createRackSchema>;

export const updateRackSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  description: optionalText(200),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRackInput = z.infer<typeof updateRackSchema>;

export const createRackSlotSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(12)
    .regex(/^[A-Z0-9-]+$/),
  capacity: z.coerce.number().int().min(1).max(100).default(1),
});
export type CreateRackSlotInput = z.infer<typeof createRackSlotSchema>;

export const updateRackSlotSchema = z.object({
  capacity: z.coerce.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRackSlotInput = z.infer<typeof updateRackSlotSchema>;

export const assignRackSchema = z.object({
  rackSlotId: idSchema,
  note: optionalText(300),
});
export type AssignRackInput = z.infer<typeof assignRackSchema>;
