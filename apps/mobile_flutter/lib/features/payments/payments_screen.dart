import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/store_context.dart';
import '../../core/domain/enums.dart';
import '../../core/format/business_time.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/store_switcher.dart';
import 'data/payments_repository.dart';

final todaysPaymentsProvider = FutureProvider.autoDispose<PaymentList>((ref) {
  final today = BusinessTime.todayKey();
  return ref.watch(paymentsRepositoryProvider).list(from: today, to: today, storeId: ref.watch(selectedStoreIdProvider));
});

/// Today's collections. Payments are recorded from an order (full or partial).
class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(todaysPaymentsProvider);
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("Today's payments"), actions: const [StoreSwitcher(), SizedBox(width: 8)]),
      body: ContentWidth(
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(todaysPaymentsProvider.future),
          child: AsyncBody(
            value: value,
            onRetry: () => ref.invalidate(todaysPaymentsProvider),
            data: (list) => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Collected today', style: theme.textTheme.labelLarge),
                          Text(
                            money.format(list.totalCollected),
                            style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          Text('${list.page.total} payments', style: theme.textTheme.bodySmall),
                        ],
                      ),
                    ),
                  ),
                ),
                if (list.page.items.isEmpty) const EmptyState(icon: Icons.payments_outlined, title: 'No payments yet today'),
                for (final p in list.page.items)
                  ListTile(
                    leading: const Icon(Icons.receipt_outlined),
                    title: Text('${money.format(p.amount)} · ${p.method.label}'),
                    subtitle: Text('${p.order.orderNumber} · ${p.customer.fullName} · ${Fmt.time(p.receivedAt)}'),
                    trailing: p.status == PaymentStatus.completed ? null : Text(p.status.label),
                    onTap: () => context.push(Routes.order(p.order.id)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
