import { Role } from './enums';

/**
 * Granular permissions. The UI uses predefined roles for now, but every API
 * endpoint checks one of these permissions so roles can become configurable later.
 */
export const Permission = {
  DASHBOARD_VIEW: 'dashboard.view',

  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_DISCOUNT: 'orders.discount',
  /** Move an order through processing stages (RECEIVED → … → READY). */
  ORDERS_PROCESS: 'orders.process',
  /** Hand the order to the customer (READY → DELIVERED). */
  ORDERS_DELIVER: 'orders.deliver',
  ORDERS_DELIVER_WITH_BALANCE: 'orders.deliver_with_balance',
  ORDERS_CANCEL: 'orders.cancel',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',

  GARMENTS_VIEW: 'garments.view',
  GARMENTS_UPDATE: 'garments.update',

  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',

  CATALOG_VIEW: 'catalog.view',
  CATALOG_MANAGE: 'catalog.manage',

  RACKS_VIEW: 'racks.view',
  RACKS_ASSIGN: 'racks.assign',
  RACKS_MANAGE: 'racks.manage',

  TASKS_VIEW_ALL: 'tasks.view_all',
  TASKS_VIEW_OWN: 'tasks.view_own',
  TASKS_MANAGE: 'tasks.manage',
  TASKS_UPDATE_STATUS: 'tasks.update_status',

  REPORTS_VIEW: 'reports.view',

  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',

  SETTINGS_MANAGE: 'settings.manage',
  STORES_MANAGE: 'stores.manage',

  AUDIT_VIEW: 'audit.view',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

const P = Permission;

const MANAGER_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter((p) => p !== P.SETTINGS_MANAGE && p !== P.STORES_MANAGE);

const COUNTER_PERMISSIONS: Permission[] = [
  P.ORDERS_VIEW,
  P.ORDERS_CREATE,
  P.ORDERS_EDIT,
  P.ORDERS_DISCOUNT,
  P.ORDERS_PROCESS,
  P.ORDERS_DELIVER,
  P.CUSTOMERS_VIEW,
  P.CUSTOMERS_MANAGE,
  P.GARMENTS_VIEW,
  P.GARMENTS_UPDATE,
  P.PAYMENTS_VIEW,
  P.PAYMENTS_CREATE,
  P.CATALOG_VIEW,
  P.RACKS_VIEW,
  P.RACKS_ASSIGN,
  P.TASKS_VIEW_ALL,
  P.TASKS_MANAGE,
  P.TASKS_UPDATE_STATUS,
];

const PROCESSING_PERMISSIONS: Permission[] = [
  P.ORDERS_VIEW,
  P.ORDERS_PROCESS,
  P.GARMENTS_VIEW,
  P.GARMENTS_UPDATE,
  P.RACKS_VIEW,
  P.RACKS_ASSIGN,
  P.CATALOG_VIEW,
];

const DRIVER_PERMISSIONS: Permission[] = [P.TASKS_VIEW_OWN, P.TASKS_UPDATE_STATUS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.OWNER]: ALL_PERMISSIONS,
  [Role.MANAGER]: MANAGER_PERMISSIONS,
  [Role.COUNTER_STAFF]: COUNTER_PERMISSIONS,
  [Role.PROCESSING_STAFF]: PROCESSING_PERMISSIONS,
  [Role.DRIVER]: DRIVER_PERMISSIONS,
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

/** Roles that may see every store in the tenant regardless of store assignment. */
export const ALL_STORE_ROLES: readonly Role[] = [Role.OWNER];

/** Which roles a given role may create or assign. Owners are created only at registration. */
export const ASSIGNABLE_ROLES: Record<Role, readonly Role[]> = {
  [Role.OWNER]: [Role.MANAGER, Role.COUNTER_STAFF, Role.PROCESSING_STAFF, Role.DRIVER],
  [Role.MANAGER]: [Role.COUNTER_STAFF, Role.PROCESSING_STAFF, Role.DRIVER],
  [Role.COUNTER_STAFF]: [],
  [Role.PROCESSING_STAFF]: [],
  [Role.DRIVER]: [],
};

/** Default landing page for each role after login. */
export const ROLE_HOME: Record<Role, string> = {
  [Role.OWNER]: '/dashboard',
  [Role.MANAGER]: '/dashboard',
  [Role.COUNTER_STAFF]: '/orders/new',
  [Role.PROCESSING_STAFF]: '/garments',
  [Role.DRIVER]: '/driver',
};
