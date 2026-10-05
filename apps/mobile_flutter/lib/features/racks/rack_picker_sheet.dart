import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/common.dart';
import 'data/racks_repository.dart';

final rackBoardProvider = FutureProvider.autoDispose.family<RackBoard, String?>(
  (ref, storeId) => ref.watch(racksRepositoryProvider).board(storeId: storeId),
);

/// Lets the user pick a free rack slot in [storeId]. Returns the slot id.
Future<String?> pickRackSlot(BuildContext context, {required String storeId, String? currentSlotId}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (context, scroll) => _RackPicker(storeId: storeId, currentSlotId: currentSlotId, scroll: scroll),
    ),
  );
}

class _RackPicker extends ConsumerWidget {
  const _RackPicker({required this.storeId, this.currentSlotId, required this.scroll});
  final String storeId;
  final String? currentSlotId;
  final ScrollController scroll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = ref.watch(rackBoardProvider(storeId));
    final theme = Theme.of(context);
    return AsyncBody(
      value: value,
      onRetry: () => ref.invalidate(rackBoardProvider(storeId)),
      data: (board) {
        final racks = board.racks.where((r) => r.isActive).toList();
        if (racks.isEmpty) return const EmptyState(icon: Icons.shelves, title: 'No racks set up for this store');
        return ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text(currentSlotId == null ? 'Assign rack slot' : 'Move to another slot', style: theme.textTheme.titleLarge),
            Text('${board.stats.slots - board.stats.occupied} of ${board.stats.slots} slots free', style: theme.textTheme.bodyMedium),
            for (final rack in racks) ...[
              SectionHeader('${rack.name} (${rack.code})'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final slot in rack.slots.where((s) => s.isActive))
                    _SlotChip(
                      slot: slot,
                      current: slot.id == currentSlotId,
                      onTap: slot.available && slot.id != currentSlotId ? () => Navigator.pop(context, slot.id) : null,
                    ),
                ],
              ),
            ],
          ],
        );
      },
    );
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({required this.slot, required this.current, this.onTap});
  final RackSlot slot;
  final bool current;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final free = slot.available;
    final bg = current ? scheme.primary : (free ? scheme.primaryContainer : scheme.surfaceContainerHighest);
    final fg = current ? scheme.onPrimary : (free ? scheme.onPrimaryContainer : scheme.outline);
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: SizedBox(
          width: 72,
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                slot.code,
                style: TextStyle(color: fg, fontWeight: FontWeight.w700),
              ),
              Text(
                current ? 'Current' : (free ? 'Free' : '${slot.orders.length}/${slot.capacity}'),
                style: TextStyle(color: fg, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
