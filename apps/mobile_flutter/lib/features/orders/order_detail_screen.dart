import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/domain/enums.dart';
import '../../core/format/formatters.dart';
import '../../core/util/launch.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/dialogs.dart';
import '../payments/payment_sheet.dart';
import '../racks/rack_picker_sheet.dart';
import 'data/order_models.dart';
import 'data/orders_repository.dart';
import 'widgets/order_totals.dart';

final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, String>(
  (ref, id) => ref.watch(ordersRepositoryProvider).get(id),
);

/// Label for the button that moves an order to [to].
String transitionLabel(OrderStatus from, OrderStatus to) => switch (to) {
  OrderStatus.processing => from == OrderStatus.received ? 'Start processing' : 'Send back to processing',
  OrderStatus.qualityCheck => 'Send to quality check',
  OrderStatus.ready => 'Mark ready',
  OrderStatus.delivered => 'Mark delivered',
  OrderStatus.cancelled => 'Cancel order',
  _ => to.label,
};

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(orderDetailProvider(widget.orderId));
      await ref.read(orderDetailProvider(widget.orderId).future);
      if (mounted && success != null) showSnack(context, success);
    } on Object catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeStatus(OrderDetail order, OrderStatus to) async {
    final session = ref.read(sessionProvider);
    final repo = ref.read(ordersRepositoryProvider);
    if (to == OrderStatus.cancelled) {
      final reason = await askText(context, title: 'Cancel ${order.orderNumber}?', label: 'Reason', action: 'Cancel order', minLength: 3);
      if (reason == null) return;
      return _run(() => repo.cancel(order.id, reason), success: 'Order cancelled');
    }
    var allowOutstanding = false;
    if (to == OrderStatus.delivered && order.balanceDue.isPositive) {
      final money = ref.read(moneyFormatProvider);
      if (!session.can(Perm.ordersDeliverWithBalance)) {
        final pay = await confirmDialog(
          context,
          title: 'Balance due',
          message: '${money.format(order.balanceDue)} is still outstanding. Collect payment before delivering.',
          action: 'Collect payment',
        );
        if (pay && mounted) await _addPayment(order);
        return;
      }
      allowOutstanding = await confirmDialog(
        context,
        title: 'Deliver on credit?',
        message: '${money.format(order.balanceDue)} is still outstanding. Hand over the order anyway?',
        action: 'Deliver on credit',
      );
      if (!allowOutstanding) return;
    }
    await _run(() => repo.changeStatus(order.id, to, allowOutstanding: allowOutstanding), success: '${order.orderNumber} → ${to.label}');
  }

  Future<void> _addPayment(OrderDetail order) async {
    final ok = await showPaymentSheet(context, orderId: order.id, orderNumber: order.orderNumber, balance: order.balanceDue);
    if (ok) await _run(() async {}, success: 'Payment recorded');
  }

  Future<void> _assignRack(OrderDetail order) async {
    final slotId = await pickRackSlot(context, storeId: order.store.id, currentSlotId: order.rack?.slotId);
    if (slotId == null) return;
    await _run(
      () => ref.read(ordersRepositoryProvider).assignRack(order.id, slotId),
      success: order.rack == null ? 'Rack assigned' : 'Moved to new slot',
    );
  }

  Future<void> _releaseRack(OrderDetail order) async {
    final ok = await confirmDialog(
      context,
      title: 'Release ${order.rack!.slotCode}?',
      message: 'The order will no longer be on a rack.',
      action: 'Release',
    );
    if (ok) await _run(() => ref.read(ordersRepositoryProvider).releaseRack(order.id), success: 'Rack released');
  }

  Future<void> _statusSheet(OrderDetail order) async {
    final session = ref.read(sessionProvider);
    final options = order.workflow.allowedTransitions.where((s) {
      if (s == OrderStatus.cancelled) return session.can(Perm.ordersCancel);
      if (s == OrderStatus.delivered) return session.can(Perm.ordersDeliver);
      return session.can(Perm.ordersProcess);
    }).toList();
    final to = await showModalBottomSheet<OrderStatus>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text('Change status', style: Theme.of(context).textTheme.titleLarge),
            ),
            if (options.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No status changes available.')),
            for (final s in options)
              ListTile(
                leading: OrderStatusPill(s),
                title: Text(transitionLabel(order.status, s)),
                textColor: s == OrderStatus.cancelled ? Theme.of(context).colorScheme.error : null,
                onTap: () => Navigator.pop(context, s),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (to != null && mounted) await _changeStatus(order, to);
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(orderDetailProvider(widget.orderId));
    final order = value.value;
    return Scaffold(
      appBar: AppBar(
        title: Text(order?.orderNumber ?? 'Order'),
        actions: [
          if (order != null && order.workflow.allowedTransitions.isNotEmpty)
            IconButton(tooltip: 'Change status', icon: const Icon(Icons.swap_horiz), onPressed: _busy ? null : () => _statusSheet(order)),
        ],
        bottom: _busy ? const PreferredSize(preferredSize: Size.fromHeight(4), child: LinearProgressIndicator()) : null,
      ),
      body: ContentWidth(
        maxWidth: 1200,
        child: AsyncBody(
          value: value,
          onRetry: () => ref.invalidate(orderDetailProvider(widget.orderId)),
          data: (o) => RefreshIndicator(
            onRefresh: () => ref.refresh(orderDetailProvider(widget.orderId).future),
            child: _OrderBody(order: o, busy: _busy, onAssignRack: () => _assignRack(o), onReleaseRack: () => _releaseRack(o)),
          ),
        ),
      ),
      bottomNavigationBar: order == null
          ? null
          : _ActionBar(order: order, busy: _busy, onStatus: (s) => _changeStatus(order, s), onPay: () => _addPayment(order)),
    );
  }
}

class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.order, required this.busy, required this.onStatus, required this.onPay});
  final OrderDetail order;
  final bool busy;
  final ValueChanged<OrderStatus> onStatus;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final next = order.workflow.nextStatus;
    final canNext = next != null && session.can(next == OrderStatus.delivered ? Perm.ordersDeliver : Perm.ordersProcess);
    final canPay = order.canTakePayment && session.can(Perm.paymentsCreate);
    if (!canNext && !canPay) return const SizedBox.shrink();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Row(
          children: [
            if (canPay)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : onPay,
                  icon: const Icon(Icons.payments_outlined),
                  label: const Text('Add payment'),
                ),
              ),
            if (canPay && canNext) const SizedBox(width: 12),
            if (canNext)
              Expanded(
                child: FilledButton.icon(
                  onPressed: busy ? null : () => onStatus(next),
                  icon: Icon(next == OrderStatus.delivered ? Icons.done_all : Icons.arrow_forward),
                  label: Text(transitionLabel(order.status, next), overflow: TextOverflow.ellipsis),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _OrderBody extends ConsumerWidget {
  const _OrderBody({required this.order, required this.busy, required this.onAssignRack, required this.onReleaseRack});
  final OrderDetail order;
  final bool busy;
  final VoidCallback onAssignRack;
  final VoidCallback onReleaseRack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatProvider);
    final session = ref.watch(sessionProvider);
    final theme = Theme.of(context);
    final o = order;
    final wide = isWide(context);

    final summary = [
      _Card(
        children: [
          Row(
            children: [
              OrderStatusPill(o.status),
              const SizedBox(width: 8),
              PaymentStatusPill(o.paymentStatus),
              const Spacer(),
              Text(o.store.name, style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 12),
          InfoRow(
            'Due',
            Fmt.relativeDue(o.dueDate),
            valueColor: !o.status.isTerminal && o.dueDate.isBefore(DateTime.now()) ? theme.colorScheme.error : null,
          ),
          InfoRow('Created', Fmt.dateTime(o.createdAt)),
          InfoRow('Pieces', '${o.totalPieces}'),
          InfoRow('Delivery', o.deliveryMode.label),
        ],
      ),
      _Card(
        title: 'Customer',
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: session.can(Perm.customersView) ? () => context.push(Routes.customer(o.customer.id)) : null,
            child: Row(
              children: [
                CircleAvatar(child: Text(o.customer.firstName.characters.first.toUpperCase())),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(o.customer.fullName, style: theme.textTheme.bodyLarge),
                      Text(o.customer.phone, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                IconButton.filledTonal(tooltip: 'Call', icon: const Icon(Icons.call), onPressed: () => dialPhone(o.customer.phone)),
              ],
            ),
          ),
        ],
      ),
      _Card(
        title: 'Payment',
        children: [OrderTotals(order: o, money: money)],
      ),
      _Card(
        title: 'Rack',
        children: [
          Row(
            children: [
              Icon(Icons.shelves, color: o.rack == null ? theme.colorScheme.outline : theme.colorScheme.primary),
              const SizedBox(width: 12),
              Expanded(
                child: o.rack == null
                    ? Text('Not on a rack', style: theme.textTheme.bodyLarge)
                    : Text('${o.rack!.slotCode} · ${o.rack!.rackName}', style: theme.textTheme.titleMedium),
              ),
            ],
          ),
          if (session.can(Perm.racksAssign) && o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : onAssignRack,
                    icon: Icon(o.rack == null ? Icons.add : Icons.open_with),
                    label: Text(o.rack == null ? 'Assign rack' : 'Move'),
                  ),
                ),
                if (o.rack != null) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy ? null : onReleaseRack,
                      icon: const Icon(Icons.logout),
                      label: const Text('Release'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    ];

    final details = [
      _Card(
        title: 'Items',
        children: [
          for (final l in o.lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${l.itemName} × ${Fmt.quantity(l.quantity)}${l.unitType == UnitType.kg ? ' kg' : ''}',
                          style: theme.textTheme.bodyLarge,
                        ),
                        Text(
                          [l.categoryName, '${money.format(l.unitPrice)} each', ...l.modifiers.map((m) => m.name)].join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  Text(money.format(l.lineTotal), style: theme.textTheme.bodyLarge),
                ],
              ),
            ),
        ],
      ),
      _Card(
        title: 'Garments (${o.garments.length})',
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final g in o.garments)
                Tooltip(
                  message: [g.status.label, if (g.color != null) g.color!, ...g.issues].join(' · '),
                  child: Chip(
                    avatar: Icon(Icons.sell_outlined, size: 16, color: theme.colorScheme.primary),
                    label: Text(g.tagCode, style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()])),
                    visualDensity: VisualDensity.compact,
                    side: g.issues.isNotEmpty ? BorderSide(color: theme.colorScheme.error) : null,
                  ),
                ),
            ],
          ),
        ],
      ),
      _Card(
        title: 'Status timeline',
        children: [_Timeline(order: o)],
      ),
      if (o.payments.isNotEmpty)
        _Card(
          title: 'Payments',
          children: [
            for (final p in o.payments)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: const Icon(Icons.receipt_outlined),
                title: Text('${money.format(p.amount)} · ${p.method.label}'),
                subtitle: Text(
                  [
                    Fmt.dateTime(p.receivedAt),
                    if (p.receivedBy != null) p.receivedBy!.name,
                    if (p.reference != null) p.reference!,
                  ].join(' · '),
                ),
                trailing: p.status == PaymentStatus.completed ? null : Text(p.status.label),
              ),
          ],
        ),
      if (o.notes != null && o.notes!.isNotEmpty) _Card(title: 'Notes', children: [Text(o.notes!)]),
    ];

    if (wide) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Column(children: _spaced(summary))),
            const SizedBox(width: 16),
            Expanded(flex: 1, child: Column(children: _spaced(details))),
          ],
        ),
      );
    }
    return ListView(padding: const EdgeInsets.all(16), children: _spaced([...summary, ...details]));
  }

  static List<Widget> _spaced(List<Widget> w) => [
    for (var i = 0; i < w.length; i++) ...[if (i > 0) const SizedBox(height: 12), w[i]],
  ];
}

class _Card extends StatelessWidget {
  const _Card({this.title, required this.children});
  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Text(title!, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
          ],
          ...children,
        ],
      ),
    ),
  );
}

/// Workflow stages with timestamps from the status history.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.order});
  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final history = [...order.statusHistory]..sort((a, b) => a.changedAt.compareTo(b.changedAt));
    final stages = order.status == OrderStatus.cancelled ? [...history.map((h) => h.toStatus)] : OrderStatus.stages;
    final reached = order.status.stageIndex;
    return Column(
      children: [
        for (var i = 0; i < stages.length; i++)
          Builder(
            builder: (context) {
              final stage = stages[i];
              final entry = history.lastWhere(
                (h) => h.toStatus == stage,
                orElse: () => StatusHistoryEntry(id: '', toStatus: OrderStatus.unknown, changedAt: DateTime(0)),
              );
              final done = entry.toStatus != OrderStatus.unknown && (order.status == OrderStatus.cancelled || stage.stageIndex <= reached);
              final color = done ? theme.colorScheme.primary : theme.colorScheme.outlineVariant;
              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Column(
                      children: [
                        Icon(done ? Icons.check_circle : Icons.radio_button_unchecked, size: 20, color: color),
                        if (i < stages.length - 1) Expanded(child: VerticalDivider(width: 20, thickness: 2, color: color)),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              stage.label,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                fontWeight: done ? FontWeight.w600 : null,
                                color: done ? null : theme.colorScheme.outline,
                              ),
                            ),
                            if (done)
                              Text(
                                [
                                  Fmt.dateTime(entry.changedAt),
                                  if (entry.changedBy != null) entry.changedBy!.name,
                                  if (entry.note != null) entry.note!,
                                ].join(' · '),
                                style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
