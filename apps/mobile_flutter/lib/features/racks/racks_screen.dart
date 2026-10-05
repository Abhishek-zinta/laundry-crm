import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/auth/store_context.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/dialogs.dart';
import '../../core/widgets/store_switcher.dart';
import '../orders/data/order_models.dart';
import '../orders/data/orders_repository.dart';
import 'data/racks_repository.dart';
import 'rack_picker_sheet.dart';

/// Rack board: every slot with the orders on it. Tap a free slot to assign
/// an order; tap an occupied slot to move or release its orders.
class RacksScreen extends ConsumerWidget {
  const RacksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storeId = ref.watch(workingStoreProvider)?.id;
    final value = ref.watch(rackBoardProvider(storeId));
    return Scaffold(
      appBar: AppBar(title: const Text('Racks'), actions: const [StoreSwitcher(allowAll: false), SizedBox(width: 8)]),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(rackBoardProvider(storeId).future),
        child: AsyncBody(
          value: value,
          onRetry: () => ref.invalidate(rackBoardProvider(storeId)),
          data: (board) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text('${board.stats.occupied} of ${board.stats.slots} slots in use', style: Theme.of(context).textTheme.bodyLarge),
              for (final rack in board.racks.where((r) => r.isActive)) ...[
                SectionHeader('${rack.name} (${rack.code})'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [for (final slot in rack.slots.where((s) => s.isActive)) _SlotTile(slot: slot, storeId: storeId!)],
                ),
              ],
              if (board.racks.isEmpty) const EmptyState(icon: Icons.shelves, title: 'No racks set up for this store'),
            ],
          ),
        ),
      ),
    );
  }
}

class _SlotTile extends ConsumerWidget {
  const _SlotTile({required this.slot, required this.storeId});
  final RackSlot slot;
  final String storeId;

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() action, String message) async {
    try {
      await action();
      ref.invalidate(rackBoardProvider);
      if (context.mounted) showSnack(context, message);
    } on Object catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _assignOrder(BuildContext context, WidgetRef ref) async {
    final order = await showModalBottomSheet<OrderListItem>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _OrderPicker(slotCode: slot.code, storeId: storeId),
    );
    if (order == null || !context.mounted) return;
    await _run(context, ref, () => ref.read(ordersRepositoryProvider).assignRack(order.id, slot.id), '${order.orderNumber} → ${slot.code}');
  }

  Future<void> _manage(BuildContext context, WidgetRef ref, SlotOrder o) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text('${o.orderNumber} · ${o.customerName}'),
              subtitle: Text('${slot.code} · ${o.totalPieces} pcs · ${o.status.label}'),
            ),
            ListTile(leading: const Icon(Icons.receipt_long), title: const Text('Open order'), onTap: () => Navigator.pop(context, 'open')),
            ListTile(
              leading: const Icon(Icons.open_with),
              title: const Text('Move to another slot'),
              onTap: () => Navigator.pop(context, 'move'),
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Release from rack'),
              onTap: () => Navigator.pop(context, 'release'),
            ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;
    final repo = ref.read(ordersRepositoryProvider);
    switch (action) {
      case 'open':
        await context.push(Routes.order(o.id));
        ref.invalidate(rackBoardProvider);
      case 'move':
        final to = await pickRackSlot(context, storeId: storeId, currentSlotId: slot.id);
        if (to != null && context.mounted) await _run(context, ref, () => repo.assignRack(o.id, to), '${o.orderNumber} moved');
      case 'release':
        if (await confirmDialog(
              context,
              title: 'Release ${o.orderNumber}?',
              message: 'It will be removed from ${slot.code}.',
              action: 'Release',
            ) &&
            context.mounted) {
          await _run(context, ref, () => repo.releaseRack(o.id), '${slot.code} released');
        }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canAssign = ref.watch(sessionProvider).can(Perm.racksAssign);
    final scheme = Theme.of(context).colorScheme;
    final occupied = slot.orders.isNotEmpty;
    return Material(
      color: occupied ? scheme.secondaryContainer : scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: !canAssign
            ? null
            : occupied
            ? () => _manage(context, ref, slot.orders.first)
            : () => _assignOrder(context, ref),
        child: SizedBox(
          width: 104,
          height: 76,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(slot.code, style: const TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                if (occupied) ...[
                  Text(slot.orders.first.orderNumber, style: const TextStyle(fontSize: 11), overflow: TextOverflow.ellipsis),
                  Text(slot.orders.first.customerName, style: const TextStyle(fontSize: 11), overflow: TextOverflow.ellipsis),
                ] else
                  Text('Free', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Lists open orders that are not on a rack yet.
class _OrderPicker extends ConsumerStatefulWidget {
  const _OrderPicker({required this.slotCode, required this.storeId});
  final String slotCode;
  final String storeId;

  @override
  ConsumerState<_OrderPicker> createState() => _OrderPickerState();
}

class _OrderPickerState extends ConsumerState<_OrderPicker> {
  late final Future<List<OrderListItem>> _orders = ref
      .read(ordersRepositoryProvider)
      .list(OrderQuery(quick: OrderQuickFilter.ready, storeId: widget.storeId), pageSize: 100)
      .then((p) => p.items.where((o) => o.rack == null).toList());

  @override
  Widget build(BuildContext context) {
    final money = ref.watch(moneyFormatProvider);
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.7,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text('Put a ready order on ${widget.slotCode}', style: Theme.of(context).textTheme.titleLarge),
          ),
          Expanded(
            child: FutureBuilder(
              future: _orders,
              builder: (context, snap) {
                if (snap.hasError) return ErrorView(error: snap.error!);
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                final orders = snap.data!;
                if (orders.isEmpty) return const EmptyState(icon: Icons.inventory_2_outlined, title: 'No ready orders waiting for a rack');
                return ListView.separated(
                  itemCount: orders.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final o = orders[i];
                    return ListTile(
                      title: Text('${o.orderNumber} · ${o.customer.fullName}'),
                      subtitle: Text('${o.totalPieces} pcs · due ${Fmt.relativeDue(o.dueDate)}'),
                      trailing: Text(money.format(o.grandTotal)),
                      onTap: () => Navigator.pop(context, o),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
