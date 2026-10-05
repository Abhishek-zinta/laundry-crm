import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/theme.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/store_context.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/store_switcher.dart';
import '../orders/data/order_models.dart';
import '../orders/widgets/order_tile.dart';
import 'data/dashboard_repository.dart';

final dashboardProvider = FutureProvider.autoDispose<Dashboard>(
  (ref) => ref.watch(dashboardRepositoryProvider).load(storeId: ref.watch(selectedStoreIdProvider)),
);

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final value = ref.watch(dashboardProvider);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hi, ${session.user.name.split(' ').first}'),
            Text(Fmt.weekdayDate(), style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        actions: const [StoreSwitcher(), SizedBox(width: 8)],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(dashboardProvider.future),
        child: AsyncBody(value: value, onRetry: () => ref.invalidate(dashboardProvider), data: (d) => _DashboardBody(d)),
      ),
    );
  }
}

class _DashboardBody extends ConsumerWidget {
  const _DashboardBody(this.d);
  final Dashboard d;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatProvider);
    final m = d.metrics;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 840 ? 5 : (width >= 600 ? 3 : 2);
    final tiles = [
      _Metric('Today\'s revenue', money.format(m.revenueToday), '${m.paymentsToday} payments', Icons.payments_outlined),
      _Metric('Today\'s orders', '${m.ordersToday}', 'Booked today', Icons.receipt_long_outlined),
      _Metric('Pending', '${m.pendingOrders}', 'In process', Icons.hourglass_bottom),
      _Metric('Ready', '${m.readyOrders}', 'For pickup', Icons.check_circle_outline),
      _Metric(
        'Outstanding',
        money.format(m.unpaidAmount),
        '${m.unpaidOrders} orders',
        Icons.account_balance_wallet_outlined,
        warn: m.unpaidAmount.isPositive,
      ),
    ];

    final dueAndOverdue = [...d.overdue, ...d.dueToday];
    final dueHeader = SectionHeader(
      'Due today',
      trailing: d.overdue.isNotEmpty
          ? Pill(
              label: '${d.overdue.length} overdue',
              colors: StatusColors.danger(Theme.of(context).colorScheme),
              icon: Icons.warning_amber_rounded,
            )
          : null,
    );
    final recentHeader = SectionHeader(
      'Recent orders',
      trailing: TextButton(onPressed: () => context.go(Routes.orders), child: const Text('View all')),
    );
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: GridView.count(
            crossAxisCount: columns,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: columns == 2 ? 1.45 : 1.6,
            children: tiles,
          ),
        ),
        if (width >= 840)
          // Tablet landscape: the two lists side by side instead of one very wide column.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  children: [
                    dueHeader,
                    _OrderCard(orders: dueAndOverdue, empty: 'Nothing due today.'),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  children: [
                    recentHeader,
                    _OrderCard(orders: d.recentOrders, empty: 'No orders yet.'),
                  ],
                ),
              ),
            ],
          )
        else ...[
          dueHeader,
          _OrderCard(orders: dueAndOverdue, empty: 'Nothing due today.'),
          recentHeader,
          _OrderCard(orders: d.recentOrders, empty: 'No orders yet.'),
        ],
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.caption, this.icon, {this.warn = false});
  final String label;
  final String value;
  final String caption;
  final IconData icon;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = warn ? theme.colorScheme.error : theme.colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(icon, size: 20, color: accent),
              ],
            ),
            const Spacer(),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: warn ? accent : null),
              ),
            ),
            Text(caption, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.orders, required this.empty});
  final List<OrderListItem> orders;
  final String empty;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: orders.isEmpty
            ? Padding(
                padding: const EdgeInsets.all(24),
                child: Center(child: Text(empty)),
              )
            : Column(
                children: [
                  for (var i = 0; i < orders.length; i++) ...[if (i > 0) const Divider(height: 1), OrderTile(orders[i])],
                ],
              ),
      ),
    );
  }
}
