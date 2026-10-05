// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payments_repository.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentOrderRef _$PaymentOrderRefFromJson(Map<String, dynamic> json) =>
    PaymentOrderRef(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
    );

PaymentListItem _$PaymentListItemFromJson(Map<String, dynamic> json) =>
    PaymentListItem(
      id: json['id'] as String,
      amount: const MoneyConverter().fromJson(json['amount'] as String),
      method: const PaymentMethodConverter().fromJson(json['method'] as String),
      reference: json['reference'] as String?,
      status: const PaymentStatusConverter().fromJson(json['status'] as String),
      receivedAt: DateTime.parse(json['receivedAt'] as String),
      order: PaymentOrderRef.fromJson(json['order'] as Map<String, dynamic>),
      customer: CustomerRef.fromJson(json['customer'] as Map<String, dynamic>),
    );

PaymentResultOrder _$PaymentResultOrderFromJson(Map<String, dynamic> json) =>
    PaymentResultOrder(
      grandTotal: const MoneyConverter().fromJson(json['grandTotal'] as String),
      paidAmount: const MoneyConverter().fromJson(json['paidAmount'] as String),
      balanceDue: const MoneyConverter().fromJson(json['balanceDue'] as String),
      paymentStatus: const OrderPaymentStatusConverter().fromJson(
        json['paymentStatus'] as String,
      ),
    );
