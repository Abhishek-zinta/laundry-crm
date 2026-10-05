// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_repository.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DashboardMetrics _$DashboardMetricsFromJson(
  Map<String, dynamic> json,
) => DashboardMetrics(
  revenueToday: const MoneyConverter().fromJson(json['revenueToday'] as String),
  paymentsToday: (json['paymentsToday'] as num).toInt(),
  ordersToday: (json['ordersToday'] as num).toInt(),
  pendingOrders: (json['pendingOrders'] as num).toInt(),
  readyOrders: (json['readyOrders'] as num).toInt(),
  unpaidAmount: const MoneyConverter().fromJson(json['unpaidAmount'] as String),
  unpaidOrders: (json['unpaidOrders'] as num).toInt(),
  overdueOrders: (json['overdueOrders'] as num).toInt(),
  pickupsToday: (json['pickupsToday'] as num).toInt(),
  deliveriesToday: (json['deliveriesToday'] as num).toInt(),
);

Dashboard _$DashboardFromJson(Map<String, dynamic> json) => Dashboard(
  metrics: DashboardMetrics.fromJson(json['metrics'] as Map<String, dynamic>),
  recentOrders: (json['recentOrders'] as List<dynamic>)
      .map((e) => OrderListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  dueToday: (json['dueToday'] as List<dynamic>)
      .map((e) => OrderListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  overdue: (json['overdue'] as List<dynamic>)
      .map((e) => OrderListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);
