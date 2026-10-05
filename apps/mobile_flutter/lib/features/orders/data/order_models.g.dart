// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderListItem _$OrderListItemFromJson(Map<String, dynamic> json) =>
    OrderListItem(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: const OrderStatusConverter().fromJson(json['status'] as String),
      paymentStatus: const OrderPaymentStatusConverter().fromJson(
        json['paymentStatus'] as String,
      ),
      grandTotal: const MoneyConverter().fromJson(json['grandTotal'] as String),
      paidAmount: const MoneyConverter().fromJson(json['paidAmount'] as String),
      balanceDue: const MoneyConverter().fromJson(json['balanceDue'] as String),
      totalPieces: (json['totalPieces'] as num).toInt(),
      dueDate: DateTime.parse(json['dueDate'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      customer: CustomerRef.fromJson(json['customer'] as Map<String, dynamic>),
      store: StoreRef.fromJson(json['store'] as Map<String, dynamic>),
      rack: json['rack'] == null
          ? null
          : RackLocation.fromJson(json['rack'] as Map<String, dynamic>),
    );

OrderLineModifier _$OrderLineModifierFromJson(Map<String, dynamic> json) =>
    OrderLineModifier(
      name: json['name'] as String,
      amount: const MoneyConverter().fromJson(json['amount'] as String),
    );

OrderLine _$OrderLineFromJson(Map<String, dynamic> json) => OrderLine(
  id: json['id'] as String,
  categoryName: json['categoryName'] as String,
  itemName: json['itemName'] as String,
  unitType: const UnitTypeConverter().fromJson(json['unitType'] as String),
  quantity: json['quantity'] as String,
  unitPrice: const MoneyConverter().fromJson(json['unitPrice'] as String),
  modifiersAmount: const MoneyConverter().fromJson(
    json['modifiersAmount'] as String,
  ),
  lineTotal: const MoneyConverter().fromJson(json['lineTotal'] as String),
  notes: json['notes'] as String?,
  modifiers:
      (json['modifiers'] as List<dynamic>?)
          ?.map((e) => OrderLineModifier.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Garment _$GarmentFromJson(Map<String, dynamic> json) => Garment(
  id: json['id'] as String,
  orderId: json['orderId'] as String,
  orderLineId: json['orderLineId'] as String,
  tagCode: json['tagCode'] as String,
  status: const OrderStatusConverter().fromJson(json['status'] as String),
  color: json['color'] as String?,
  brand: json['brand'] as String?,
  issues:
      (json['issues'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  damageNotes: json['damageNotes'] as String?,
  specialInstructions: json['specialInstructions'] as String?,
);

StatusHistoryEntry _$StatusHistoryEntryFromJson(Map<String, dynamic> json) =>
    StatusHistoryEntry(
      id: json['id'] as String,
      fromStatus: _$JsonConverterFromJson<String, OrderStatus>(
        json['fromStatus'],
        const OrderStatusConverter().fromJson,
      ),
      toStatus: const OrderStatusConverter().fromJson(
        json['toStatus'] as String,
      ),
      changedAt: DateTime.parse(json['changedAt'] as String),
      changedBy: json['changedBy'] == null
          ? null
          : UserRef.fromJson(json['changedBy'] as Map<String, dynamic>),
      note: json['note'] as String?,
    );

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Payment _$PaymentFromJson(Map<String, dynamic> json) => Payment(
  id: json['id'] as String,
  amount: const MoneyConverter().fromJson(json['amount'] as String),
  method: const PaymentMethodConverter().fromJson(json['method'] as String),
  reference: json['reference'] as String?,
  status: const PaymentStatusConverter().fromJson(json['status'] as String),
  receivedAt: DateTime.parse(json['receivedAt'] as String),
  receivedBy: json['receivedBy'] == null
      ? null
      : UserRef.fromJson(json['receivedBy'] as Map<String, dynamic>),
);

OrderWorkflow _$OrderWorkflowFromJson(Map<String, dynamic> json) =>
    OrderWorkflow(
      allowedTransitions: (json['allowedTransitions'] as List<dynamic>)
          .map((e) => const OrderStatusConverter().fromJson(e as String))
          .toList(),
      nextStatus: _$JsonConverterFromJson<String, OrderStatus>(
        json['nextStatus'],
        const OrderStatusConverter().fromJson,
      ),
      canEditItems: json['canEditItems'] as bool,
    );

OrderCustomer _$OrderCustomerFromJson(Map<String, dynamic> json) =>
    OrderCustomer(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String,
      alternatePhone: json['alternatePhone'] as String?,
      email: json['email'] as String?,
    );

OrderDetail _$OrderDetailFromJson(Map<String, dynamic> json) => OrderDetail(
  id: json['id'] as String,
  orderNumber: json['orderNumber'] as String,
  status: const OrderStatusConverter().fromJson(json['status'] as String),
  paymentStatus: const OrderPaymentStatusConverter().fromJson(
    json['paymentStatus'] as String,
  ),
  subtotal: const MoneyConverter().fromJson(json['subtotal'] as String),
  discountType: _$JsonConverterFromJson<String, DiscountType>(
    json['discountType'],
    const DiscountTypeConverter().fromJson,
  ),
  discountValue: json['discountValue'] as String?,
  discountAmount: const MoneyConverter().fromJson(
    json['discountAmount'] as String,
  ),
  taxName: json['taxName'] as String?,
  taxRate: json['taxRate'] as String,
  taxInclusive: json['taxInclusive'] as bool,
  taxAmount: const MoneyConverter().fromJson(json['taxAmount'] as String),
  grandTotal: const MoneyConverter().fromJson(json['grandTotal'] as String),
  paidAmount: const MoneyConverter().fromJson(json['paidAmount'] as String),
  balanceDue: const MoneyConverter().fromJson(json['balanceDue'] as String),
  totalPieces: (json['totalPieces'] as num).toInt(),
  dueDate: DateTime.parse(json['dueDate'] as String),
  deliveryMode: const DeliveryModeConverter().fromJson(
    json['deliveryMode'] as String,
  ),
  notes: json['notes'] as String?,
  createdAt: DateTime.parse(json['createdAt'] as String),
  customer: OrderCustomer.fromJson(json['customer'] as Map<String, dynamic>),
  store: StoreRef.fromJson(json['store'] as Map<String, dynamic>),
  lines: (json['lines'] as List<dynamic>)
      .map((e) => OrderLine.fromJson(e as Map<String, dynamic>))
      .toList(),
  garments: (json['garments'] as List<dynamic>)
      .map((e) => Garment.fromJson(e as Map<String, dynamic>))
      .toList(),
  statusHistory: (json['statusHistory'] as List<dynamic>)
      .map((e) => StatusHistoryEntry.fromJson(e as Map<String, dynamic>))
      .toList(),
  payments: (json['payments'] as List<dynamic>)
      .map((e) => Payment.fromJson(e as Map<String, dynamic>))
      .toList(),
  rack: json['rack'] == null
      ? null
      : RackLocation.fromJson(json['rack'] as Map<String, dynamic>),
  workflow: OrderWorkflow.fromJson(json['workflow'] as Map<String, dynamic>),
);
