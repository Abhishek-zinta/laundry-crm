import 'package:flutter/material.dart';

import '../../../core/domain/enums.dart';
import '../../../core/format/money.dart';
import '../../../core/widgets/common.dart';
import '../data/order_models.dart';

/// Money breakdown for an order: subtotal → discount → tax → total → paid → outstanding.
class OrderTotals extends StatelessWidget {
  const OrderTotals({super.key, required this.order, required this.money});
  final OrderDetail order;
  final MoneyFormatter money;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final o = order;
    final taxLabel = '${o.taxName ?? 'Tax'} (${_percent(o.taxRate)}%${o.taxInclusive ? ', incl.' : ''})';
    return Column(
      children: [
        InfoRow('Subtotal', money.format(o.subtotal)),
        if (o.discountAmount.isPositive) InfoRow(_discountLabel(o), '− ${money.format(o.discountAmount)}'),
        if (o.taxAmount.isPositive) InfoRow(taxLabel, money.format(o.taxAmount)),
        const Divider(height: 16),
        InfoRow('Total', money.format(o.grandTotal), emphasize: true),
        InfoRow('Paid', money.format(o.paidAmount), valueColor: o.paidAmount.isPositive ? Colors.green.shade700 : null),
        InfoRow(
          'Outstanding',
          money.format(o.balanceDue),
          emphasize: true,
          valueColor: o.balanceDue.isPositive ? scheme.error : Colors.green.shade700,
        ),
      ],
    );
  }

  static String _discountLabel(OrderDetail o) =>
      o.discountType == DiscountType.percent && o.discountValue != null ? 'Discount (${_percent(o.discountValue!)}%)' : 'Discount';

  static String _percent(String v) {
    final n = num.tryParse(v) ?? 0;
    return n == n.roundToDouble() ? n.toInt().toString() : n.toString();
  }
}
