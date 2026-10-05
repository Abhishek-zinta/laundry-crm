import type { Permission, Role } from '@rinseops/shared';
import { forbidden } from '../errors/app-error';

/** Authenticated request context, resolved from the session cookie on every request. */
export interface AuthContext {
  /** Web cookie session id, or native-app MobileSession id. */
  sessionId: string;
  /** How the caller authenticated: web cookie or native-app bearer token. */
  authType: 'cookie' | 'mobile';
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  /** True for roles that can see every store in the tenant. */
  allStores: boolean;
  /** Store ids the user is assigned to (all active stores when allStores). */
  storeIds: string[];
  ipAddress?: string;
}

export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function assertPermission(ctx: AuthContext, permission: Permission, message?: string): void {
  if (!ctx.permissions.has(permission)) throw forbidden(message);
}

export function canAccessStore(ctx: AuthContext, storeId: string): boolean {
  return ctx.allStores || ctx.storeIds.includes(storeId);
}

export function assertStoreAccess(ctx: AuthContext, storeId: string): void {
  if (!canAccessStore(ctx, storeId)) {
    throw forbidden("You don't have access to this store.", 'STORE_ACCESS_DENIED');
  }
}

/**
 * Prisma `where` fragment restricting rows to stores the user may see,
 * optionally narrowed to one requested store.
 */
export function storeScope(ctx: AuthContext, requestedStoreId?: string | null): { storeId?: string | { in: string[] } } {
  if (requestedStoreId) {
    assertStoreAccess(ctx, requestedStoreId);
    return { storeId: requestedStoreId };
  }
  if (ctx.allStores) return {};
  return { storeId: { in: ctx.storeIds } };
}

/** Store ids for raw SQL filters; null means "no restriction". */
export function storeIdsForSql(ctx: AuthContext, requestedStoreId?: string | null): string[] | null {
  if (requestedStoreId) {
    assertStoreAccess(ctx, requestedStoreId);
    return [requestedStoreId];
  }
  return ctx.allStores ? null : ctx.storeIds;
}
