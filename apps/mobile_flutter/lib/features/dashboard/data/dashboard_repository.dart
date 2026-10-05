import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import '../../../core/format/money.dart';
import '../../orders/data/order_models.dart';

part 'dashboard_repository.g.dart';

@apiModel
class DashboardMetrics {
  const DashboardMetrics({
    required this.revenueToday,
    required this.paymentsToday,
    required this.ordersToday,
    required this.pendingOrders,
    required this.readyOrders,
    required this.unpaidAmount,
    required this.unpaidOrders,
    required this.overdueOrders,
    required this.pickupsToday,
    required this.deliveriesToday,
  });
  final Money revenueToday;
  final int paymentsToday;
  final int ordersToday;
  final int pendingOrders;
  final int readyOrders;
  final Money unpaidAmount;
  final int unpaidOrders;
  final int overdueOrders;
  final int pickupsToday;
  final int deliveriesToday;

  factory DashboardMetrics.fromJson(Map<String, dynamic> json) => _$DashboardMetricsFromJson(json);
}

@apiModel
class Dashboard {
  const Dashboard({required this.metrics, required this.recentOrders, required this.dueToday, required this.overdue});
  final DashboardMetrics metrics;
  final List<OrderListItem> recentOrders;
  final List<OrderListItem> dueToday;
  final List<OrderListItem> overdue;

  factory Dashboard.fromJson(Map<String, dynamic> json) => _$DashboardFromJson(json);
}

final dashboardRepositoryProvider = Provider((ref) => DashboardRepository(ref.watch(apiClientProvider)));

class DashboardRepository {
  DashboardRepository(this._api);
  final ApiClient _api;

  /// [storeId] null = every store the user can access.
  Future<Dashboard> load({String? storeId}) async =>
      Dashboard.fromJson(await _api.get<Map<String, dynamic>>('/dashboard', query: {'storeId': storeId}));
}
