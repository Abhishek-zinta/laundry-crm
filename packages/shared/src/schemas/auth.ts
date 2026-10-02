import { z } from 'zod';
import { emailSchema, phoneSchema } from './common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200, 'Password is too long');

export const registerSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, 'Use 3-48 lowercase letters, numbers or dashes')
    .optional(),
  ownerName: z.string().trim().min(2, 'Your name is required').max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  storeName: z.string().trim().min(2, 'Store name is required').max(120),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  timezone: z.string().trim().min(1).max(64).default('Asia/Kolkata'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
