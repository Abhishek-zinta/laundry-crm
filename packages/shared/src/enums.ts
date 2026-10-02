/**
 * Domain enums shared by the API and the web app.
 * Values must stay in sync with the Prisma schema enums (verified by a test in the API).
 */

const values = <T extends Record<string, string>>(obj: T) => Object.values(obj) as T[keyof T][];

export const Role = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  COUNTER_STAFF: 'COUNTER_STAFF',
  PROCESSING_STAFF: 'PROCESSING_STAFF',
  DRIVER: 'DRIVER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = values(Role);

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UnitType = {
  PIECE: 'PIECE',
  KG: 'KG',
  PAIR: 'PAIR',
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];
export const UNIT_TYPES = values(UnitType);

export const ModifierType = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED',
} as const;
export type ModifierType = (typeof ModifierType)[keyof typeof ModifierType];

export const DiscountType = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED',
} as const;
export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const OrderStatus = {
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  QUALITY_CHECK: 'QUALITY_CHECK',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const ORDER_STATUSES = values(OrderStatus);

export const GarmentStatus = OrderStatus;
export type GarmentStatus = OrderStatus;

export const OrderPaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;
export type OrderPaymentStatus = (typeof OrderPaymentStatus)[keyof typeof OrderPaymentStatus];
export const ORDER_PAYMENT_STATUSES = values(OrderPaymentStatus);

export const DeliveryMode = {
  STORE_PICKUP: 'STORE_PICKUP',
  HOME_DELIVERY: 'HOME_DELIVERY',
} as const;
export type DeliveryMode = (typeof DeliveryMode)[keyof typeof DeliveryMode];

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const PAYMENT_METHODS = values(PaymentMethod);

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PAYMENT_STATUSES = values(PaymentStatus);

export const TaskType = {
  PICKUP: 'PICKUP',
  DELIVERY: 'DELIVERY',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];
export const TASK_TYPES = values(TaskType);

export const TaskStatus = {
  SCHEDULED: 'SCHEDULED',
  ASSIGNED: 'ASSIGNED',
  OUT_FOR_PICKUP: 'OUT_FOR_PICKUP',
  PICKED_UP: 'PICKED_UP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export const TASK_STATUSES = values(TaskStatus);

export const TaskSource = {
  STAFF: 'STAFF',
  PUBLIC_BOOKING: 'PUBLIC_BOOKING',
} as const;
export type TaskSource = (typeof TaskSource)[keyof typeof TaskSource];

export const GarmentIssue = {
  EXISTING_DAMAGE: 'EXISTING_DAMAGE',
  STAIN: 'STAIN',
  TEAR: 'TEAR',
  MISSING_BUTTON: 'MISSING_BUTTON',
  COLOR_BLEED_RISK: 'COLOR_BLEED_RISK',
  DELICATE: 'DELICATE',
  SHRINK_RISK: 'SHRINK_RISK',
  FADED: 'FADED',
  COLLAR_WEAR: 'COLLAR_WEAR',
} as const;
export type GarmentIssue = (typeof GarmentIssue)[keyof typeof GarmentIssue];
export const GARMENT_ISSUES = values(GarmentIssue);

export const RackRemovalReason = {
  MOVED: 'MOVED',
  DELIVERED: 'DELIVERED',
  REMOVED: 'REMOVED',
  CANCELLED: 'CANCELLED',
} as const;
export type RackRemovalReason = (typeof RackRemovalReason)[keyof typeof RackRemovalReason];

export const AuditAction = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  RACK_ASSIGNED: 'RACK_ASSIGNED',
  RACK_MOVED: 'RACK_MOVED',
  RACK_REMOVED: 'RACK_REMOVED',
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  STAFF_ROLE_CHANGED: 'STAFF_ROLE_CHANGED',
  STAFF_STATUS_CHANGED: 'STAFF_STATUS_CHANGED',
  GARMENT_STATUS_CHANGED: 'GARMENT_STATUS_CHANGED',
  GARMENT_UPDATED: 'GARMENT_UPDATED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_STATUS_CHANGED: 'TASK_STATUS_CHANGED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  CATALOG_UPDATED: 'CATALOG_UPDATED',
  STORE_CREATED: 'STORE_CREATED',
  STORE_UPDATED: 'STORE_UPDATED',
  USER_LOGIN: 'USER_LOGIN',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
