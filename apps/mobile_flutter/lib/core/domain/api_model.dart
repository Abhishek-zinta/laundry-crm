import 'package:json_annotation/json_annotation.dart';

import '../format/money.dart';
import 'enums.dart';

/// Annotation for read-only API response models: decimal strings become
/// [Money] and SCREAMING_SNAKE strings become Dart enums.
const apiModel = JsonSerializable(
  createToJson: false,
  converters: [
    MoneyConverter(),
    RoleConverter(),
    OrderStatusConverter(),
    OrderPaymentStatusConverter(),
    PaymentMethodConverter(),
    PaymentStatusConverter(),
    UnitTypeConverter(),
    DeliveryModeConverter(),
    DiscountTypeConverter(),
    ModifierTypeConverter(),
    TaskTypeConverter(),
    TaskStatusConverter(),
  ],
);

/// A page of results from a list endpoint.
class Paged<T> {
  const Paged({required this.items, required this.total, required this.page, required this.pageSize});

  final List<T> items;
  final int total;
  final int page;
  final int pageSize;

  bool get hasMore => page * pageSize < total;

  factory Paged.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) item) => Paged(
    items: (json['items'] as List).map((e) => item(e as Map<String, dynamic>)).toList(),
    total: json['total'] as int,
    page: json['page'] as int,
    pageSize: json['pageSize'] as int,
  );
}
