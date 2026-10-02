import { Prisma, PrismaClient } from '@prisma/client';

/** Models that carry a tenantId column and must always be scoped. */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models.filter((m) => m.name !== 'Tenant' && m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name),
);

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type AnyArgs = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown };

function withTenantData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => withTenantData(d, tenantId));
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    // Relation-style input ("tenant: { connect }") cannot be mixed with the scalar.
    if ('tenant' in record) return record;
    return { ...record, tenantId };
  }
  return data;
}

/**
 * Returns a Prisma client where every query on a tenant-owned model is
 * automatically constrained to `tenantId`:
 *  - reads/updates/deletes get `tenantId` merged into `where`
 *  - creates get `tenantId` injected into `data`
 *
 * This is the primary tenant-isolation mechanism. Raw SQL ($queryRaw)
 * bypasses it and must filter by tenant explicitly.
 */
export function createTenantClient(base: PrismaClient, tenantId: string) {
  if (!tenantId) throw new Error('tenantId is required for a tenant-scoped client');
  return base.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);
          const a = { ...(args as AnyArgs) };

          if (WHERE_OPERATIONS.has(operation)) {
            a.where = { ...(a.where ?? {}), tenantId };
          } else if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
            a.data = withTenantData(a.data, tenantId);
          } else if (operation === 'upsert') {
            a.where = { ...(a.where ?? {}), tenantId };
            a.create = withTenantData(a.create, tenantId);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof createTenantClient>;
/** Transaction client of a tenant-scoped client (same scoping applies). */
export type TenantTx = Parameters<Parameters<TenantDb['$transaction']>[0]>[0];
/** Either the tenant client or a transaction started from it. */
export type TenantDbOrTx = TenantDb | TenantTx;
