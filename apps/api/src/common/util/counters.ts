import type { TenantDbOrTx } from '../prisma/tenant-extension';

/**
 * Atomically reserves `count` values from a per-tenant sequence and returns
 * the first reserved value. Must run inside the transaction that uses the
 * numbers so a rollback does not leave the row locked.
 */
export async function reserveSequence(db: TenantDbOrTx, tenantId: string, key: string, count = 1): Promise<number> {
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "TenantCounter" ("tenantId", "key", "value")
    VALUES (${tenantId}::uuid, ${key}, ${count})
    ON CONFLICT ("tenantId", "key")
    DO UPDATE SET "value" = "TenantCounter"."value" + EXCLUDED."value"
    RETURNING "value"`;
  const last = rows[0]?.value;
  if (last === undefined) throw new Error(`Failed to reserve sequence ${key}`);
  return last - count + 1;
}
