import { Prisma } from '@prisma/client';

/** `AND alias."storeId" IN (...)` or empty when the user can see every store. */
export function storeFilterSql(storeIds: string[] | null, alias: string): Prisma.Sql {
  if (storeIds === null) return Prisma.empty;
  if (!storeIds.length) return Prisma.sql`AND false`;
  const column = Prisma.raw(`${alias}."storeId"`);
  return Prisma.sql`AND ${column} IN (${Prisma.join(storeIds.map((id) => Prisma.sql`${id}::uuid`))})`;
}

/** Postgres expression for the local calendar day of a timestamptz column. */
export function localDaySql(column: string, timeZone: string): Prisma.Sql {
  return Prisma.sql`to_char(${Prisma.raw(column)} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
}

export const num = (v: Prisma.Decimal | bigint | number | string | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);
