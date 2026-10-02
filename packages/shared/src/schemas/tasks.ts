import { z } from 'zod';
import { TASK_STATUSES, TASK_TYPES } from '../enums';
import { addressSchema } from './customers';
import { dateOnlySchema, idSchema, optionalEmailSchema, optionalText, paginationSchema, phoneSchema } from './common';

export const createTaskSchema = z
  .object({
    type: z.enum(TASK_TYPES),
    storeId: idSchema,
    customerId: idSchema,
    orderId: idSchema.optional().nullable(),
    addressId: idSchema.optional().nullable(),
    /** Free-text address used when no saved address is chosen. */
    address: z.string().trim().max(400).optional().nullable(),
    scheduledDate: dateOnlySchema,
    timeSlot: z.string().trim().min(3).max(40),
    assignedDriverId: idSchema.optional().nullable(),
    requestedService: optionalText(120),
    notes: optionalText(1000),
  })
  .refine((t) => t.addressId || (t.address && t.address.length > 3), {
    message: 'An address is required',
    path: ['address'],
  });
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  scheduledDate: dateOnlySchema.optional(),
  timeSlot: z.string().trim().min(3).max(40).optional(),
  address: z.string().trim().min(4).max(400).optional(),
  notes: optionalText(1000),
  requestedService: optionalText(120),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const assignTaskSchema = z.object({
  driverId: idSchema.nullable(),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const changeTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  note: optionalText(500),
});
export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>;

export const taskListQuerySchema = paginationSchema.extend({
  type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  scope: z.enum(['open', 'today', 'upcoming', 'completed', 'all']).default('open'),
  date: dateOnlySchema.optional(),
  driverId: idSchema.optional(),
  storeId: idSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const publicBookingSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  phone: phoneSchema,
  email: optionalEmailSchema,
  address: addressSchema.pick({ addressLine1: true, addressLine2: true, landmark: true, city: true, postalCode: true }),
  pickupDate: dateOnlySchema,
  timeSlot: z.string().trim().min(3).max(40),
  requestedService: optionalText(120),
  notes: optionalText(1000),
  storeId: idSchema.optional(),
  /** Honeypot field — real users never fill it. */
  website: z.string().max(200).optional(),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
