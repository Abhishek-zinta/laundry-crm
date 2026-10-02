import { moneyString } from '@rinseops/shared';
import type { Prisma } from '@prisma/client';

/** Prisma Decimal → canonical money string ("120.00"). */
export const money = (value: Prisma.Decimal | string | number | null | undefined): string =>
  moneyString(value === null || value === undefined ? 0 : value.toString());

export const optionalMoney = (value: Prisma.Decimal | null | undefined): string | null =>
  value === null || value === undefined ? null : moneyString(value.toString());

/** Formats a Prisma @db.Date value as YYYY-MM-DD. */
export const dateKey = (value: Date): string => value.toISOString().slice(0, 10);

export const dateFromKey = (key: string): Date => new Date(`${key}T00:00:00.000Z`);
