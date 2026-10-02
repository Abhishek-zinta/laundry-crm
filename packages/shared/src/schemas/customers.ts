import { z } from 'zod';
import { idSchema, optionalEmailSchema, optionalPhoneSchema, optionalText, paginationSchema, phoneSchema } from './common';

export const addressSchema = z.object({
  label: z.string().trim().max(40).default('Home'),
  addressLine1: z.string().trim().min(2, 'Address is required').max(200),
  addressLine2: optionalText(200),
  landmark: optionalText(120),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: optionalText(80),
  phone: phoneSchema,
  alternatePhone: optionalPhoneSchema,
  email: optionalEmailSchema,
  notes: optionalText(2000),
  priceListId: idSchema.optional().nullable(),
  address: addressSchema.optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.omit({ address: true }).partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['recent', 'name', 'orders', 'spent', 'balance']).default('recent'),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
