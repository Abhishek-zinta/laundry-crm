import { z } from 'zod';

export const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;
export const QUANTITY_RE = /^\d{1,6}(\.\d{1,3})?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const idSchema = z.uuid({ message: 'Invalid id' });

/** Non-negative money amount, accepted as string or number, emitted as string. */
export const moneySchema = z.coerce.string().trim().regex(MONEY_RE, 'Enter a valid amount with up to 2 decimals');

export const positiveMoneySchema = moneySchema.refine((v) => Number(v) > 0, 'Amount must be greater than zero');

export const quantitySchema = z.coerce
  .string()
  .trim()
  .regex(QUANTITY_RE, 'Enter a valid quantity')
  .refine((v) => Number(v) > 0, 'Quantity must be greater than zero');

export const percentSchema = moneySchema.refine((v) => Number(v) <= 100, 'Percentage cannot exceed 100');

/** Calendar date in YYYY-MM-DD form (interpreted in the business timezone). */
export const dateOnlySchema = z.string().regex(DATE_RE, 'Use YYYY-MM-DD');

export const isoDateTimeSchema = z.iso.datetime({ offset: true, message: 'Invalid date/time' });

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v));

export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .regex(/^\+?[\d\s\-()]+$/, 'Phone number can only contain digits, spaces, dashes and +');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const booleanQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

/** Optional email that treats an empty string as "not provided". */
export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v));

export const optionalPhoneSchema = z
  .union([z.literal(''), phoneSchema])
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v));
