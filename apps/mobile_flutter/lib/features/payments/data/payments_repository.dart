import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/domain/refs.dart';
import '../../../core/format/money.dart';
import '../../../core/util/ids.dart';

part 'payments_repository.g.dart';

@apiModel
class PaymentOrderRef {
  const PaymentOrderRef({required this.id, required this.orderNumber});
  final String id;
  final String orderNumber;

  factory PaymentOrderRef.fromJson(Map<String, dynamic> json) => _$PaymentOrderRefFromJson(json);
}

@apiModel
class PaymentListItem {
  const PaymentListItem({
    required this.id,
    required this.amount,
    required this.method,
    this.reference,
    required this.status,
    required this.receivedAt,
    required this.order,
    required this.customer,
  });
  final String id;
  final Money amount;
  final PaymentMethod method;
  final String? reference;
  final PaymentStatus status;
  final DateTime receivedAt;
  final PaymentOrderRef order;
  final CustomerRef customer;

  factory PaymentListItem.fromJson(Map<String, dynamic> json) => _$PaymentListItemFromJson(json);
}

class PaymentList {
  const PaymentList(this.page, this.totalCollected);
  final Paged<PaymentListItem> page;
  final Money totalCollected;
}

/// Order totals returned after recording a payment.
@apiModel
class PaymentResultOrder {
  const PaymentResultOrder({required this.grandTotal, required this.paidAmount, required this.balanceDue, required this.paymentStatus});
  final Money grandTotal;
  final Money paidAmount;
  final Money balanceDue;
  final OrderPaymentStatus paymentStatus;

  factory PaymentResultOrder.fromJson(Map<String, dynamic> json) => _$PaymentResultOrderFromJson(json);
}

final paymentsRepositoryProvider = Provider((ref) => PaymentsRepository(ref.watch(apiClientProvider)));

class PaymentsRepository {
  PaymentsRepository(this._api);
  final ApiClient _api;

  /// Records a full or partial payment against an order.
  Future<PaymentResultOrder> record({
    required String orderId,
    required Money amount,
    required PaymentMethod method,
    String? reference,
    String? idempotencyKey,
  }) async {
    final json = await _api.post<Map<String, dynamic>>(
      '/payments',
      body: {
        'orderId': orderId,
        'amount': amount.toApi(),
        'method': method.wire,
        if (reference != null && reference.trim().isNotEmpty) 'reference': reference.trim(),
        'idempotencyKey': idempotencyKey ?? newIdempotencyKey('pay'),
      },
    );
    return PaymentResultOrder.fromJson(json['order'] as Map<String, dynamic>);
  }

  /// [from]/[to] are business calendar dates (YYYY-MM-DD).
  Future<PaymentList> list({String? from, String? to, String? storeId, int page = 1}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/payments',
      query: {'from': from, 'to': to, 'storeId': storeId, 'page': page, 'pageSize': 50},
    );
    final summary = json['summary'] as Map<String, dynamic>;
    return PaymentList(Paged.fromJson(json, PaymentListItem.fromJson), Money.parse(summary['totalCollected'] as String));
  }
}
