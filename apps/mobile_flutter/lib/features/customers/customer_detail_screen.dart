import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/format/formatters.dart';
import '../../core/util/launch.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/paged.dart';
import '../orders/data/order_models.dart';
import '../orders/orders_screen.dart';
import '../orders/widgets/order_tile.dart';
import 'data/customer_models.dart';
import 'data/customers_repository.dart';

final customerDetailProvider = FutureProvider.autoDispose.family<CustomerDetail, String>(
  (ref, id) => ref.watch(customersRepositoryProvider).get(id),
);

class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId});
  final String customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(customerDetailProvider(customerId));
    final canSeeOrders = ref.watch(sessionProvider).can(Perm.ordersView);
    final ordersQuery = OrderQuery(customerId: customerId);
    return Scaffold(
      appBar: AppBar(title: Text(value.value?.fullName ?? 'Customer')),
      body: ContentWidth(
        child: AsyncBody(
          value: value,
          onRetry: () => ref.invalidate(customerDetailProvider(customerId)),
          data: (c) {
            final header = _CustomerHeader(customer: c);
            if (!canSeeOrders) return ListView(children: [header]);
            final orders = ref.watch(ordersListProvider(ordersQuery));
            return PagedBody(
              value: orders,
              onRetry: () => ref.invalidate(ordersListProvider(ordersQuery)),
              builder: (state) => PagedListView<OrderListItem>(
                state: state,
                header: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    header,
                    SectionHeader(
                      'Order history (${state.total}${c.stats.cancelledOrders > 0 ? ' · ${c.stats.cancelledOrders} cancelled' : ''})',
                    ),
                  ],
                ),
                onLoadMore: () => ref.read(ordersListProvider(ordersQuery).notifier).loadMore(),
                onRefresh: () {
                  ref.invalidate(customerDetailProvider(customerId));
                  return ref.refresh(ordersListProvider(ordersQuery).future);
                },
                itemBuilder: (_, o) => OrderTile(o),
                empty: const EmptyState(icon: Icons.receipt_long_outlined, title: 'No orders yet'),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CustomerHeader extends ConsumerWidget {
  const _CustomerHeader({required this.customer});
  final CustomerDetail customer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final c = customer;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: _Stat(label: 'Total spent', value: money.format(c.stats.totalSpent)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Stat(
                  label: 'Outstanding',
                  value: money.format(c.stats.outstanding),
                  color: c.stats.outstanding.isPositive ? theme.colorScheme.error : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _Stat(label: 'Orders', value: '${c.stats.totalOrders}'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.phone_outlined),
                  title: Text(c.phone),
                  subtitle: c.alternatePhone != null ? Text('Alt: ${c.alternatePhone}') : null,
                  trailing: IconButton.filledTonal(tooltip: 'Call', icon: const Icon(Icons.call), onPressed: () => dialPhone(c.phone)),
                ),
                if (c.email != null) ListTile(leading: const Icon(Icons.mail_outline), title: Text(c.email!)),
                for (final a in c.addresses)
                  ListTile(
                    leading: const Icon(Icons.place_outlined),
                    title: Text(a.label + (a.isDefault ? ' · default' : '')),
                    subtitle: Text(a.singleLine),
                    trailing: IconButton(
                      tooltip: 'Open in maps',
                      icon: const Icon(Icons.map_outlined),
                      onPressed: () => openMaps(a.singleLine),
                    ),
                  ),
                if (c.addresses.isEmpty) const ListTile(leading: Icon(Icons.place_outlined), title: Text('No saved addresses')),
                if (c.notes != null && c.notes!.isNotEmpty) ListTile(leading: const Icon(Icons.notes), title: Text(c.notes!)),
                if (c.stats.lastOrderAt != null)
                  ListTile(leading: const Icon(Icons.history), title: Text('Last order ${Fmt.date(c.stats.lastOrderAt!)}')),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
