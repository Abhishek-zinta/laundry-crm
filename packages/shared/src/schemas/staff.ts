import { z } from 'zod';
import { Role } from '../enums';
import { emailSchema, idSchema, optionalPhoneSchema } from './common';
import { passwordSchema } from './auth';

const staffRole = z.enum([Role.MANAGER, Role.COUNTER_STAFF, Role.PROCESSING_STAFF, Role.DRIVER]);

export const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: optionalPhoneSchema,
  role: staffRole,
  storeIds: z.array(idSchema).max(50).default([]),
  password: passwordSchema,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: optionalPhoneSchema,
  role: staffRole.optional(),
  storeIds: z.array(idSchema).max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: passwordSchema.optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
