import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session_controller.dart';
import '../auth/store_context.dart';

/// App-bar action to switch store; hidden for single-store users.
class StoreSwitcher extends ConsumerWidget {
  const StoreSwitcher({super.key, this.allowAll = true});

  /// Offer "All stores" (only for users with access to every store).
  final bool allowAll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session.stores.length < 2) return const SizedBox.shrink();
    final selectedId = ref.watch(selectedStoreIdProvider);
    final showAll = allowAll && session.allStores;
    final current = session.stores.where((s) => s.id == selectedId).firstOrNull;
    return PopupMenuButton<String>(
      tooltip: 'Switch store',
      initialValue: selectedId ?? '',
      onSelected: (id) => ref.read(selectedStoreIdProvider.notifier).select(id.isEmpty ? null : id),
      itemBuilder: (_) => [
        if (showAll) const PopupMenuItem(value: '', child: Text('All stores')),
        for (final s in session.stores) PopupMenuItem(value: s.id, child: Text(s.name)),
      ],
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.storefront_outlined, size: 20),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Text(current?.name ?? (showAll ? 'All stores' : session.stores.first.name), overflow: TextOverflow.ellipsis),
            ),
            const Icon(Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}
