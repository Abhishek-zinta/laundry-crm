import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/domain/refs.dart';
import '../../../core/format/money.dart';

part 'order_models.g.dart';

@apiModel
class OrderListItem {
  const OrderListItem({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.grandTotal,
    required this.paidAmount,
    required this.balanceDue,
    required this.totalPieces,
    required this.dueDate,
    required this.createdAt,
    required this.customer,
    required this.store,
    this.rack,
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final OrderPaymentStatus paymentStatus;
  final Money grandTotal;
  final Money paidAmount;
  final Money balanceDue;
  final int totalPieces;
  final DateTime dueDate;
  final DateTime createdAt;
  final CustomerRef customer;
  final StoreRef store;
  final RackLocation? rack;

  bool isOverdue({DateTime? now}) => !status.isTerminal && dueDate.isBefore(now ?? DateTime.now());

  factory OrderListItem.fromJson(Map<String, dynamic> json) => _$OrderListItemFromJson(json);
}

@apiModel
class OrderLineModifier {
  const OrderLineModifier({required this.name, required this.amount});
  final String name;
  final Money amount;

  factory OrderLineModifier.fromJson(Map<String, dynamic> json) => _$OrderLineModifierFromJson(json);
}

@apiModel
class OrderLine {
  const OrderLine({
    required this.id,
    required this.categoryName,
    required this.itemName,
    required this.unitType,
    required this.quantity,
    required this.unitPrice,
    required this.modifiersAmount,
    required this.lineTotal,
    this.notes,
    this.modifiers = const [],
  });
  final String id;
  final String categoryName;
  final String itemName;
  final UnitType unitType;
  final String quantity;
  final Money unitPrice;
  final Money modifiersAmount;
  final Money lineTotal;
  final String? notes;
  final List<OrderLineModifier> modifiers;

  factory OrderLine.fromJson(Map<String, dynamic> json) => _$OrderLineFromJson(json);
}

@apiModel
class Garment {
  const Garment({
    required this.id,
    required this.orderId,
    required this.orderLineId,
    required this.tagCode,
    required this.status,
    this.color,
    this.brand,
    this.issues = const [],
    this.damageNotes,
    this.specialInstructions,
  });
  final String id;
  final String orderId;
  final String orderLineId;
  final String tagCode;
  final OrderStatus status;
  final String? color;
  final String? brand;
  final List<String> issues;
  final String? damageNotes;
  final String? specialInstructions;

  factory Garment.fromJson(Map<String, dynamic> json) => _$GarmentFromJson(json);
}

@apiModel
class StatusHistoryEntry {
  const StatusHistoryEntry({required this.id, this.fromStatus, required this.toStatus, required this.changedAt, this.changedBy, this.note});
  final String id;
  final OrderStatus? fromStatus;
  final OrderStatus toStatus;
  final DateTime changedAt;
  final UserRef? changedBy;
  final String? note;

  factory StatusHistoryEntry.fromJson(Map<String, dynamic> json) => _$StatusHistoryEntryFromJson(json);
}

@apiModel
class Payment {
  const Payment({
    required this.id,
    required this.amount,
    required this.method,
    this.reference,
    required this.status,
    required this.receivedAt,
    this.receivedBy,
  });
  final String id;
  final Money amount;
  final PaymentMethod method;
  final String? reference;
  final PaymentStatus status;
  final DateTime receivedAt;
  final UserRef? receivedBy;

  factory Payment.fromJson(Map<String, dynamic> json) => _$PaymentFromJson(json);
}

@apiModel
class OrderWorkflow {
  const OrderWorkflow({required this.allowedTransitions, this.nextStatus, required this.canEditItems});
  final List<OrderStatus> allowedTransitions;
  final OrderStatus? nextStatus;
  final bool canEditItems;

  factory OrderWorkflow.fromJson(Map<String, dynamic> json) => _$OrderWorkflowFromJson(json);
}

@apiModel
class OrderCustomer extends CustomerRef {
  const OrderCustomer({required super.id, required super.firstName, super.lastName, required super.phone, this.alternatePhone, this.email});
  final String? alternatePhone;
  final String? email;

  factory OrderCustomer.fromJson(Map<String, dynamic> json) => _$OrderCustomerFromJson(json);
}

@apiModel
class OrderDetail {
  const OrderDetail({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.subtotal,
    this.discountType,
    this.discountValue,
    required this.discountAmount,
    this.taxName,
    required this.taxRate,
    required this.taxInclusive,
    required this.taxAmount,
    required this.grandTotal,
    required this.paidAmount,
    required this.balanceDue,
    required this.totalPieces,
    required this.dueDate,
    required this.deliveryMode,
    this.notes,
    required this.createdAt,
    required this.customer,
    required this.store,
    required this.lines,
    required this.garments,
    required this.statusHistory,
    required this.payments,
    this.rack,
    required this.workflow,
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final OrderPaymentStatus paymentStatus;
  final Money subtotal;
  final DiscountType? discountType;
  final String? discountValue;
  final Money discountAmount;
  final String? taxName;
  final String taxRate;
  final bool taxInclusive;
  final Money taxAmount;
  final Money grandTotal;
  final Money paidAmount;
  final Money balanceDue;
  final int totalPieces;
  final DateTime dueDate;
  final DeliveryMode deliveryMode;
  final String? notes;
  final DateTime createdAt;
  final OrderCustomer customer;
  final StoreRef store;
  final List<OrderLine> lines;
  final List<Garment> garments;
  final List<StatusHistoryEntry> statusHistory;
  final List<Payment> payments;
  final RackLocation? rack;
  final OrderWorkflow workflow;

  bool get canTakePayment => balanceDue.isPositive && status != OrderStatus.cancelled;

  factory OrderDetail.fromJson(Map<String, dynamic> json) => _$OrderDetailFromJson(json);
}

/// Quick filters supported by GET /orders?quick=…
enum OrderQuickFilter {
  all(null, 'All'),
  today('today', 'Today'),
  dueToday('due_today', 'Due today'),
  overdue('overdue', 'Overdue'),
  ready('ready', 'Ready'),
  unpaid('unpaid', 'Unpaid');

  const OrderQuickFilter(this.wire, this.label);
  final String? wire;
  final String label;
}

class OrderQuery {
  const OrderQuery({this.quick = OrderQuickFilter.all, this.status, this.search = '', this.customerId, this.storeId});

  final OrderQuickFilter quick;
  final OrderStatus? status;
  final String search;
  final String? customerId;
  final String? storeId;

  Map<String, dynamic> toQuery({int page = 1, int pageSize = 25}) => {
    'page': page,
    'pageSize': pageSize,
    'quick': quick.wire,
    'status': status?.wire,
    'q': search.trim(),
    'customerId': customerId,
    'storeId': storeId,
  };

  OrderQuery copyWith({OrderQuickFilter? quick, OrderStatus? Function()? status, String? search}) => OrderQuery(
    quick: quick ?? this.quick,
    status: status != null ? status() : this.status,
    search: search ?? this.search,
    customerId: customerId,
    storeId: storeId,
  );

  @override
  bool operator ==(Object other) =>
      other is OrderQuery &&
      other.quick == quick &&
      other.status == status &&
      other.search == search &&
      other.customerId == customerId &&
      other.storeId == storeId;

  @override
  int get hashCode => Object.hash(quick, status, search, customerId, storeId);
}
