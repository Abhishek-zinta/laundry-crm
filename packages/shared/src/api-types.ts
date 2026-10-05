/**
 * Response shapes returned by the RinseOps REST API. Money values are decimal
 * strings ("120.00"); timestamps are ISO-8601 UTC strings; calendar dates are YYYY-MM-DD.
 */
import type {
  DeliveryMode,
  DiscountType,
  GarmentIssue,
  ModifierType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RackRemovalReason,
  Role,
  TaskSource,
  TaskStatus,
  TaskType,
  UnitType,
  UserStatus,
} from './enums';
import type { Permission } from './permissions';

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface StoreRef {
  id: string;
  name: string;
  code?: string;
}

export interface CustomerRef {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface TenantSettingsDto {
  currency: string;
  locale: string;
  timezone: string;
  brandColor: string;
  taxName: string;
  taxRate: string;
  taxInclusive: boolean;
  taxNumber: string | null;
  orderPrefix: string;
  invoicePrefix: string;
  garmentPrefix: string;
  receiptFooter: string | null;
  defaultTurnaroundHours: number;
  skipQualityCheck: boolean;
  bookingEnabled: boolean;
  timeSlots: string[];
  defaultPriceListId: string | null;
}

export interface MeDto {
  user: { id: string; name: string; email: string; phone: string | null; role: Role };
  permissions: Permission[];
  home: string;
  allStores: boolean;
  stores: Array<{ id: string; name: string; code: string; phone: string | null; address: string | null }>;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    settings: TenantSettingsDto;
  };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface AddressDto {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
}

export interface CustomerListItem extends CustomerRef {
  email: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: string;
  balance: string;
  lastOrderAt: string | null;
}

export interface RackLocation {
  slotId: string;
  slotCode: string;
  rackId: string;
  rackName: string;
  rackCode: string;
}

export interface CustomerDetail extends CustomerRef {
  alternatePhone: string | null;
  email: string | null;
  notes: string | null;
  priceListId: string | null;
  priceList: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  addresses: AddressDto[];
  /** Totals exclude cancelled orders; `cancelledOrders` counts those separately. */
  stats: { totalOrders: number; cancelledOrders: number; totalSpent: string; outstanding: string; lastOrderAt: string | null };
  openOrders: Array<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    dueDate: string;
    grandTotal: string;
    balanceDue: string;
    paymentStatus: OrderPaymentStatus;
    totalPieces: number;
    rack: { slot: string; rackName: string } | null;
  }>;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface ServiceCategoryDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface ServiceItemDto {
  id: string;
  name: string;
  unitType: UnitType;
  piecesPerUnit: number;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface PriceListDto {
  id: string;
  name: string;
  description: string | null;
  storeId: string | null;
  store: StoreRef | null;
  isDefault: boolean;
  isActive: boolean;
  isTenantDefault: boolean;
  _count: { items: number; customers: number };
}

export interface ModifierDto {
  id: string;
  name: string;
  type: ModifierType;
  value: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CatalogOverview {
  categories: ServiceCategoryDto[];
  items: ServiceItemDto[];
  priceLists: PriceListDto[];
  modifiers: ModifierDto[];
  defaultPriceListId: string | null;
}

export interface PriceMatrixDto {
  priceList: Omit<PriceListDto, 'store' | '_count' | 'isTenantDefault'>;
  prices: Array<{ serviceCategoryId: string; serviceItemId: string; price: string; isActive: boolean }>;
}

export interface PosCatalog {
  priceList: { id: string; name: string };
  categories: Array<{
    id: string;
    name: string;
    code: string;
    color: string | null;
    items: Array<{ serviceItemId: string; name: string; unitType: UnitType; piecesPerUnit: number; icon: string | null; price: string }>;
  }>;
  modifiers: ModifierDto[];
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  grandTotal: string;
  paidAmount: string;
  balanceDue: string;
  totalPieces: number;
  dueDate: string;
  createdAt: string;
  deliveryMode: DeliveryMode;
  customer: CustomerRef;
  store: StoreRef;
  rack: RackLocation | null;
}

export interface OrderLineDto {
  id: string;
  serviceCategoryId: string;
  serviceItemId: string;
  description: string;
  categoryName: string;
  itemName: string;
  icon: string;
  unitType: UnitType;
  quantity: string;
  unitPrice: string;
  modifiersAmount: string;
  lineTotal: string;
  notes: string | null;
  position: number;
  modifiers: Array<{ id: string; modifierId: string | null; name: string; type: ModifierType; value: string; amount: string }>;
}

export interface GarmentDto {
  id: string;
  orderId: string;
  orderLineId: string;
  tagCode: string;
  status: OrderStatus;
  color: string | null;
  brand: string | null;
  fabric: string | null;
  issues: GarmentIssue[];
  damageNotes: string | null;
  specialInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  changedBy: UserRef | null;
  note: string | null;
}

export interface PaymentDto {
  id: string;
  orderId: string;
  storeId: string;
  customerId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  receivedAt: string;
  receivedBy: UserRef | null;
  refundedAt: string | null;
  refundedBy: UserRef | null;
  refundReason: string | null;
}

export interface TaskDto {
  id: string;
  type: TaskType;
  status: TaskStatus;
  source: TaskSource;
  address: string;
  scheduledDate: string;
  timeSlot: string;
  requestedService: string | null;
  notes: string | null;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
  storeId: string;
  orderId: string | null;
  customerId: string;
  assignedDriverId: string | null;
  assignedDriver: { id: string; name: string; phone: string | null } | null;
}

export interface TaskListItem extends TaskDto {
  customer: CustomerRef & { alternatePhone: string | null };
  store: StoreRef;
  order: { id: string; orderNumber: string; status: OrderStatus; balanceDue: string; totalPieces: number } | null;
  notice?: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  taxName: string | null;
  taxRate: string;
  taxInclusive: boolean;
  taxAmount: string;
  grandTotal: string;
  paidAmount: string;
  balanceDue: string;
  totalPieces: number;
  dueDate: string;
  deliveryMode: DeliveryMode;
  notes: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerRef & { alternatePhone: string | null; email: string | null; notes: string | null };
  store: StoreRef & { phone: string | null; address: string | null };
  priceList: { id: string; name: string } | null;
  deliveryAddress: AddressDto | null;
  createdBy: UserRef | null;
  lines: OrderLineDto[];
  garments: GarmentDto[];
  statusHistory: StatusHistoryDto[];
  payments: PaymentDto[];
  rack: RackLocation | null;
  rackHistory: Array<{
    id: string;
    slotCode: string;
    rackName: string;
    assignedAt: string;
    assignedBy: UserRef | null;
    removedAt: string | null;
    removedBy: UserRef | null;
    removalReason: RackRemovalReason | null;
  }>;
  tasks: TaskDto[];
  workflow: { allowedTransitions: OrderStatus[]; nextStatus: OrderStatus | null; canEditItems: boolean };
}

export interface PricingPreview {
  lines: Array<{ baseAmount: string; modifiersAmount: string; lineTotal: string }>;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  grandTotal: string;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentListItem extends PaymentDto {
  order: { id: string; orderNumber: string };
  customer: CustomerRef;
  store: StoreRef;
}

export interface PaymentList extends Paged<PaymentListItem> {
  summary: { byMethod: Array<{ method: PaymentMethod; amount: string; count: number }>; totalCollected: string };
}

export interface RecordPaymentResult extends PaymentDto {
  order: { id: string; orderNumber: string; grandTotal: string; paidAmount: string; balanceDue: string; paymentStatus: OrderPaymentStatus };
}

// ---------------------------------------------------------------------------
// Garments
// ---------------------------------------------------------------------------

export interface GarmentListItem extends GarmentDto {
  orderLine: { description: string; itemName: string; categoryName: string };
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    dueDate: string;
    balanceDue: string;
    paymentStatus: OrderPaymentStatus;
    storeId: string;
    store: StoreRef;
    customer: CustomerRef;
    rack: RackLocation | null;
  };
}

export interface GarmentDetail extends GarmentListItem {
  history: Array<StatusHistoryDto>;
}

export interface GarmentList extends Paged<GarmentListItem> {
  statusCounts: Partial<Record<OrderStatus, number>>;
}

export interface BulkGarmentResult {
  results: Array<{ tagCode: string; ok: boolean; message?: string; orderNumber?: string }>;
  updated: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Racks
// ---------------------------------------------------------------------------

export interface RackBoard {
  storeId: string | null;
  stats: { slots: number; occupied: number; capacity: number; used: number };
  racks: Array<{
    id: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    slots: Array<{
      id: string;
      code: string;
      capacity: number;
      isActive: boolean;
      available: boolean;
      orders: Array<{
        assignmentId: string;
        assignedAt: string;
        id: string;
        orderNumber: string;
        status: OrderStatus;
        balanceDue: string;
        totalPieces: number;
        dueDate: string;
        customer: CustomerRef;
        customerName: string;
      }>;
    }>;
  }>;
}

// ---------------------------------------------------------------------------
// Staff, stores, search, dashboard, reports, audit
// ---------------------------------------------------------------------------

export interface StaffDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  stores: Array<{ id: string; name: string; code: string }>;
}

export interface StoreDto {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  _count?: { users: number; racks: number };
}

export interface SearchResult {
  query: string;
  kind: 'order' | 'tag' | 'phone' | 'text';
  customers: Array<CustomerRef & { email: string | null; totalOrders: number; outstanding: string }>;
  orders: OrderListItem[];
  garments: Array<{
    id: string;
    tagCode: string;
    status: OrderStatus;
    color: string | null;
    description: string;
    order: { id: string; orderNumber: string; status: OrderStatus; balanceDue: string; customer: CustomerRef; rack: RackLocation | null };
  }>;
}

export interface DashboardDto {
  date: string;
  currency: string;
  metrics: {
    revenueToday: string;
    paymentsToday: number;
    salesToday: string;
    ordersToday: number;
    pendingOrders: number;
    readyOrders: number;
    unpaidAmount: string;
    unpaidOrders: number;
    customersToday: number;
    newCustomersToday: number;
    overdueOrders: number;
    pickupsToday: number;
    deliveriesToday: number;
  };
  statusCounts: Record<'RECEIVED' | 'PROCESSING' | 'QUALITY_CHECK' | 'READY' | 'DELIVERED', number>;
  recentOrders: OrderListItem[];
  recentPayments: Array<
    PaymentDto & { order: { id: string; orderNumber: string }; customer: { id: string; firstName: string; lastName: string | null } }
  >;
  dueToday: OrderListItem[];
  overdue: OrderListItem[];
  trend: Array<{ date: string; amount: string }>;
}

export type ReportColumnType = 'text' | 'money' | 'number' | 'date' | 'datetime' | 'percent';

export interface ReportDto {
  type: string;
  title: string;
  range: { from: string; to: string; timezone: string };
  currency: string;
  summary: Array<{ label: string; value: string | number; type: ReportColumnType }>;
  columns: Array<{ key: string; label: string; type: ReportColumnType }>;
  rows: Array<Record<string, string | number | null>>;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; role: Role } | null;
}

export interface PublicTenantProfile {
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  brandColor: string;
  bookingEnabled: boolean;
  timeSlots: string[];
  services: string[];
  stores: Array<{ id: string; name: string; address: string | null }>;
  minDate: string;
  maxDate: string;
}
