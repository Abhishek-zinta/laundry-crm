import '../../../core/domain/api_model.dart';
import '../../../core/domain/refs.dart';
import '../../../core/format/money.dart';

part 'customer_models.g.dart';

@apiModel
class CustomerListItem extends CustomerRef {
  const CustomerListItem({
    required super.id,
    required super.firstName,
    super.lastName,
    required super.phone,
    this.email,
    required this.orderCount,
    required this.totalSpent,
    required this.balance,
    this.lastOrderAt,
  });
  final String? email;
  final int orderCount;
  final Money totalSpent;
  final Money balance;
  final DateTime? lastOrderAt;

  factory CustomerListItem.fromJson(Map<String, dynamic> json) => _$CustomerListItemFromJson(json);
}

@apiModel
class Address {
  const Address({
    required this.id,
    required this.label,
    required this.addressLine1,
    this.addressLine2,
    this.landmark,
    this.city,
    this.postalCode,
    required this.isDefault,
  });
  final String id;
  final String label;
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String? city;
  final String? postalCode;
  final bool isDefault;

  String get singleLine =>
      [addressLine1, addressLine2, landmark, city, postalCode].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  factory Address.fromJson(Map<String, dynamic> json) => _$AddressFromJson(json);
}

@apiModel
class CustomerStats {
  const CustomerStats({
    required this.totalOrders,
    this.cancelledOrders = 0,
    required this.totalSpent,
    required this.outstanding,
    this.lastOrderAt,
  });

  /// Excludes cancelled orders (as do the money totals).
  final int totalOrders;

  /// Cancelled orders, which still appear in the order history.
  final int cancelledOrders;
  final Money totalSpent;
  final Money outstanding;
  final DateTime? lastOrderAt;

  factory CustomerStats.fromJson(Map<String, dynamic> json) => _$CustomerStatsFromJson(json);
}

@apiModel
class CustomerDetail extends CustomerRef {
  const CustomerDetail({
    required super.id,
    required super.firstName,
    super.lastName,
    required super.phone,
    this.alternatePhone,
    this.email,
    this.notes,
    this.priceListId,
    required this.addresses,
    required this.stats,
  });
  final String? alternatePhone;
  final String? email;
  final String? notes;
  final String? priceListId;
  final List<Address> addresses;
  final CustomerStats stats;

  factory CustomerDetail.fromJson(Map<String, dynamic> json) => _$CustomerDetailFromJson(json);
}

/// Body for POST /customers.
class NewCustomer {
  const NewCustomer({required this.firstName, this.lastName, required this.phone, this.email, this.addressLine1, this.city});
  final String firstName;
  final String? lastName;
  final String phone;
  final String? email;
  final String? addressLine1;
  final String? city;

  Map<String, dynamic> toJson() => {
    'firstName': firstName.trim(),
    if (lastName?.trim().isNotEmpty ?? false) 'lastName': lastName!.trim(),
    'phone': phone.trim(),
    if (email?.trim().isNotEmpty ?? false) 'email': email!.trim(),
    if (addressLine1?.trim().isNotEmpty ?? false)
      'address': {
        'label': 'Home',
        'addressLine1': addressLine1!.trim(),
        if (city?.trim().isNotEmpty ?? false) 'city': city!.trim(),
        'isDefault': true,
      },
  };
}
