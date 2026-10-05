// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerListItem _$CustomerListItemFromJson(Map<String, dynamic> json) =>
    CustomerListItem(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String,
      email: json['email'] as String?,
      orderCount: (json['orderCount'] as num).toInt(),
      totalSpent: const MoneyConverter().fromJson(json['totalSpent'] as String),
      balance: const MoneyConverter().fromJson(json['balance'] as String),
      lastOrderAt: json['lastOrderAt'] == null
          ? null
          : DateTime.parse(json['lastOrderAt'] as String),
    );

Address _$AddressFromJson(Map<String, dynamic> json) => Address(
  id: json['id'] as String,
  label: json['label'] as String,
  addressLine1: json['addressLine1'] as String,
  addressLine2: json['addressLine2'] as String?,
  landmark: json['landmark'] as String?,
  city: json['city'] as String?,
  postalCode: json['postalCode'] as String?,
  isDefault: json['isDefault'] as bool,
);

CustomerStats _$CustomerStatsFromJson(Map<String, dynamic> json) =>
    CustomerStats(
      totalOrders: (json['totalOrders'] as num).toInt(),
      cancelledOrders: (json['cancelledOrders'] as num?)?.toInt() ?? 0,
      totalSpent: const MoneyConverter().fromJson(json['totalSpent'] as String),
      outstanding: const MoneyConverter().fromJson(
        json['outstanding'] as String,
      ),
      lastOrderAt: json['lastOrderAt'] == null
          ? null
          : DateTime.parse(json['lastOrderAt'] as String),
    );

CustomerDetail _$CustomerDetailFromJson(Map<String, dynamic> json) =>
    CustomerDetail(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String,
      alternatePhone: json['alternatePhone'] as String?,
      email: json['email'] as String?,
      notes: json['notes'] as String?,
      priceListId: json['priceListId'] as String?,
      addresses: (json['addresses'] as List<dynamic>)
          .map((e) => Address.fromJson(e as Map<String, dynamic>))
          .toList(),
      stats: CustomerStats.fromJson(json['stats'] as Map<String, dynamic>),
    );
