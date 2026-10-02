import {
  DeliveryMode,
  GarmentIssue,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  TaskStatus,
  TaskType,
  UnitType,
} from './enums';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: 'Received',
  PROCESSING: 'Processing',
  QUALITY_CHECK: 'Quality Check',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const ORDER_PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partially paid',
  PAID: 'Paid',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  COUNTER_STAFF: 'Counter staff',
  PROCESSING_STAFF: 'Processing staff',
  DRIVER: 'Driver',
};

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  PIECE: 'per piece',
  KG: 'per kg',
  PAIR: 'per pair',
};

export const UNIT_TYPE_SHORT: Record<UnitType, string> = {
  PIECE: 'pc',
  KG: 'kg',
  PAIR: 'pair',
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  PICKUP: 'Pickup',
  DELIVERY: 'Delivery',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  SCHEDULED: 'Scheduled',
  ASSIGNED: 'Assigned',
  OUT_FOR_PICKUP: 'Out for pickup',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  STORE_PICKUP: 'Store pickup',
  HOME_DELIVERY: 'Home delivery',
};

export const GARMENT_ISSUE_LABEL: Record<GarmentIssue, string> = {
  EXISTING_DAMAGE: 'Existing damage',
  STAIN: 'Stain',
  TEAR: 'Tear',
  MISSING_BUTTON: 'Missing button',
  COLOR_BLEED_RISK: 'Colour bleed risk',
  DELICATE: 'Delicate fabric',
  SHRINK_RISK: 'Shrink risk',
  FADED: 'Faded',
  COLLAR_WEAR: 'Collar wear',
};

/** Stain types recorded at intake (stored in the garment's damage notes). */
export const STAIN_TYPES = ['Blood', 'Bleach', 'Grease', 'Food', 'Drinks', 'Ink', 'Sweat', 'Mud'] as const;

/** Quick colour swatches for garment intake: label + display hex. */
export const GARMENT_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Grey', hex: '#9ca3af' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Orange', hex: '#f59e0b' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Brown', hex: '#92400e' },
  { name: 'Beige', hex: '#e7d3b1' },
];

export const DEFAULT_TIME_SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'] as const;
