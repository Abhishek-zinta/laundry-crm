import 'package:json_annotation/json_annotation.dart';

/// API enum values are SCREAMING_SNAKE strings ("QUALITY_CHECK"); the Dart
/// names are their lowerCamel form. Unrecognised values from a newer server
/// map to `unknown` instead of crashing the app.
String _wireName(Enum e) => e.name.replaceAllMapped(RegExp('[A-Z]'), (m) => '_${m[0]}').toUpperCase();

T _fromWire<T extends Enum>(List<T> values, String wire, T fallback) =>
    values.firstWhere((v) => _wireName(v) == wire, orElse: () => fallback);

enum Role {
  owner('Owner'),
  manager('Manager'),
  counterStaff('Counter staff'),
  processingStaff('Processing staff'),
  driver('Driver'),
  unknown('Staff');

  const Role(this.label);
  final String label;
  String get wire => _wireName(this);
  static Role fromWire(String wire) => _fromWire(values, wire, unknown);
}

enum OrderStatus {
  received('Received'),
  processing('Processing'),
  qualityCheck('Quality check'),
  ready('Ready'),
  delivered('Delivered'),
  cancelled('Cancelled'),
  unknown('Unknown');

  const OrderStatus(this.label);
  final String label;
  String get wire => _wireName(this);
  static OrderStatus fromWire(String wire) => _fromWire(values, wire, unknown);

  bool get isTerminal => this == delivered || this == cancelled;

  /// Position in the normal workflow, or -1 for cancelled/unknown.
  int get stageIndex => switch (this) {
    received => 0,
    processing => 1,
    qualityCheck => 2,
    ready => 3,
    delivered => 4,
    _ => -1,
  };

  static const stages = [received, processing, qualityCheck, ready, delivered];
  static const filterable = [received, processing, qualityCheck, ready, delivered, cancelled];
}

enum OrderPaymentStatus {
  unpaid('Unpaid'),
  partial('Partly paid'),
  paid('Paid'),
  unknown('Unknown');

  const OrderPaymentStatus(this.label);
  final String label;
  String get wire => _wireName(this);
  static OrderPaymentStatus fromWire(String wire) => _fromWire(values, wire, unknown);
}

enum PaymentMethod {
  cash('Cash'),
  card('Card'),
  upi('UPI'),
  bankTransfer('Bank transfer'),
  other('Other');

  const PaymentMethod(this.label);
  final String label;
  String get wire => _wireName(this);
  static PaymentMethod fromWire(String wire) => _fromWire(values, wire, other);
}

enum PaymentStatus {
  pending('Pending'),
  completed('Completed'),
  failed('Failed'),
  refunded('Refunded'),
  unknown('Unknown');

  const PaymentStatus(this.label);
  final String label;
  String get wire => _wireName(this);
  static PaymentStatus fromWire(String wire) => _fromWire(values, wire, unknown);
}

enum UnitType {
  piece('pc'),
  kg('kg'),
  pair('pair'),
  unknown('unit');

  const UnitType(this.label);
  final String label;
  String get wire => _wireName(this);
  static UnitType fromWire(String wire) => _fromWire(values, wire, unknown);

  /// Weighed items accept fractional quantities.
  bool get allowsFraction => this == kg;
}

enum DeliveryMode {
  storePickup('Store pickup'),
  homeDelivery('Home delivery');

  const DeliveryMode(this.label);
  final String label;
  String get wire => _wireName(this);
  static DeliveryMode fromWire(String wire) => _fromWire(values, wire, storePickup);
}

enum DiscountType {
  percent,
  fixed;

  String get wire => _wireName(this);
  static DiscountType fromWire(String wire) => _fromWire(values, wire, fixed);
}

enum ModifierType {
  percent,
  fixed;

  String get wire => _wireName(this);
  static ModifierType fromWire(String wire) => _fromWire(values, wire, fixed);
}

enum TaskType {
  pickup('Pickup'),
  delivery('Delivery');

  const TaskType(this.label);
  final String label;
  String get wire => _wireName(this);
  static TaskType fromWire(String wire) => _fromWire(values, wire, pickup);
}

enum TaskStatus {
  scheduled('Scheduled'),
  assigned('Assigned'),
  outForPickup('Out for pickup'),
  pickedUp('Picked up'),
  outForDelivery('Out for delivery'),
  delivered('Delivered'),
  failed('Failed'),
  cancelled('Cancelled'),
  unknown('Unknown');

  const TaskStatus(this.label);
  final String label;
  String get wire => _wireName(this);
  static TaskStatus fromWire(String wire) => _fromWire(values, wire, unknown);

  bool get isOpen => this == scheduled || this == assigned || this == outForPickup || this == outForDelivery;
  bool get isDone => this == pickedUp || this == delivered;
}

// ---------------------------------------------------------------------------
// JSON converters (used by the generated model code).
// ---------------------------------------------------------------------------

abstract class _WireConverter<T extends Enum> implements JsonConverter<T, String> {
  const _WireConverter();
  T parse(String wire);

  @override
  T fromJson(String json) => parse(json);

  @override
  String toJson(T object) => _wireName(object);
}

class RoleConverter extends _WireConverter<Role> {
  const RoleConverter();
  @override
  Role parse(String wire) => Role.fromWire(wire);
}

class OrderStatusConverter extends _WireConverter<OrderStatus> {
  const OrderStatusConverter();
  @override
  OrderStatus parse(String wire) => OrderStatus.fromWire(wire);
}

class OrderPaymentStatusConverter extends _WireConverter<OrderPaymentStatus> {
  const OrderPaymentStatusConverter();
  @override
  OrderPaymentStatus parse(String wire) => OrderPaymentStatus.fromWire(wire);
}

class PaymentMethodConverter extends _WireConverter<PaymentMethod> {
  const PaymentMethodConverter();
  @override
  PaymentMethod parse(String wire) => PaymentMethod.fromWire(wire);
}

class PaymentStatusConverter extends _WireConverter<PaymentStatus> {
  const PaymentStatusConverter();
  @override
  PaymentStatus parse(String wire) => PaymentStatus.fromWire(wire);
}

class UnitTypeConverter extends _WireConverter<UnitType> {
  const UnitTypeConverter();
  @override
  UnitType parse(String wire) => UnitType.fromWire(wire);
}

class DeliveryModeConverter extends _WireConverter<DeliveryMode> {
  const DeliveryModeConverter();
  @override
  DeliveryMode parse(String wire) => DeliveryMode.fromWire(wire);
}

class DiscountTypeConverter extends _WireConverter<DiscountType> {
  const DiscountTypeConverter();
  @override
  DiscountType parse(String wire) => DiscountType.fromWire(wire);
}

class ModifierTypeConverter extends _WireConverter<ModifierType> {
  const ModifierTypeConverter();
  @override
  ModifierType parse(String wire) => ModifierType.fromWire(wire);
}

class TaskTypeConverter extends _WireConverter<TaskType> {
  const TaskTypeConverter();
  @override
  TaskType parse(String wire) => TaskType.fromWire(wire);
}

class TaskStatusConverter extends _WireConverter<TaskStatus> {
  const TaskStatusConverter();
  @override
  TaskStatus parse(String wire) => TaskStatus.fromWire(wire);
}
