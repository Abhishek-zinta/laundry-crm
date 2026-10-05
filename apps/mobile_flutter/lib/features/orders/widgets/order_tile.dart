import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/format/formatters.dart';
import '../../../core/widgets/common.dart';
import '../data/order_models.dart';

/// One order in a list: number, customer, amount, status, payment, due date.
class OrderTile extends ConsumerWidget {
  const OrderTile(this.order, {super.key});
  final OrderListItem order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final overdue = order.isOverdue();
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);
    return InkWell(
      onTap: () => context.push(Routes.order(order.id)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  order.orderNumber,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: 8),
                OrderStatusPill(order.status),
                const Spacer(),
                Text(money.format(order.grandTotal), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${order.customer.fullName} · ${order.totalPieces} pcs',
                    style: theme.textTheme.bodyMedium,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                PaymentStatusPill(order.paymentStatus),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.schedule, size: 14, color: overdue ? theme.colorScheme.error : theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Text(
                  'Due ${Fmt.relativeDue(order.dueDate)}',
                  style: muted?.copyWith(color: overdue ? theme.colorScheme.error : null, fontWeight: overdue ? FontWeight.w600 : null),
                ),
                if (order.rack != null) ...[
                  const SizedBox(width: 12),
                  Icon(Icons.shelves, size: 14, color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(order.rack!.slotCode, style: muted),
                ],
                const Spacer(),
                if (order.balanceDue.isPositive)
                  Text('Due ${money.format(order.balanceDue)}', style: muted?.copyWith(color: theme.colorScheme.error)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
