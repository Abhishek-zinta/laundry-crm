import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../pos/domain/cart.dart';
import 'order_models.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) => ApiOrdersRepository(ref.watch(apiClientProvider)));

/// Orders data source. The UI depends on this interface only, so a local
/// cache (e.g. a Drift-backed decorator) can be slotted in later without
/// touching screens.
abstract interface class OrdersRepository {
  Future<Paged<OrderListItem>> list(OrderQuery query, {int page = 1, int pageSize = 25});
  Future<OrderDetail> get(String id);
  Future<OrderDetail> create(CartDraft draft);
  Future<void> changeStatus(String id, OrderStatus status, {String? note, bool allowOutstanding = false});
  Future<void> cancel(String id, String reason);
  Future<void> assignRack(String orderId, String rackSlotId);
  Future<void> releaseRack(String orderId);
}

class ApiOrdersRepository implements OrdersRepository {
  ApiOrdersRepository(this._api);
  final ApiClient _api;

  @override
  Future<Paged<OrderListItem>> list(OrderQuery query, {int page = 1, int pageSize = 25}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/orders',
      query: query.toQuery(page: page, pageSize: pageSize),
    );
    return Paged.fromJson(json, OrderListItem.fromJson);
  }

  @override
  Future<OrderDetail> get(String id) async => OrderDetail.fromJson(await _api.get<Map<String, dynamic>>('/orders/$id'));

  @override
  Future<OrderDetail> create(CartDraft draft) async =>
      OrderDetail.fromJson(await _api.post<Map<String, dynamic>>('/orders', body: draft.toCreateOrderJson()));

  @override
  Future<void> changeStatus(String id, OrderStatus status, {String? note, bool allowOutstanding = false}) => _api.post<void>(
    '/orders/$id/status',
    body: {'status': status.wire, if (note != null && note.trim().isNotEmpty) 'note': note.trim(), 'allowOutstanding': allowOutstanding},
  );

  @override
  Future<void> cancel(String id, String reason) => _api.post<void>('/orders/$id/cancel', body: {'reason': reason.trim()});

  @override
  Future<void> assignRack(String orderId, String rackSlotId) => _api.post<void>('/orders/$orderId/rack', body: {'rackSlotId': rackSlotId});

  @override
  Future<void> releaseRack(String orderId) => _api.delete<void>('/orders/$orderId/rack');
}
