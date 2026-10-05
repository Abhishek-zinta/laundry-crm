import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_controller.dart';
import 'session_models.dart';

/// The store the user is working in. Owners may pick "all stores" (null)
/// for reporting screens; order creation always needs a concrete store.
final selectedStoreIdProvider = NotifierProvider<SelectedStore, String?>(SelectedStore.new);

class SelectedStore extends Notifier<String?> {
  @override
  String? build() {
    final session = ref.watch(sessionProvider);
    if (session.stores.length == 1 || !session.allStores) return session.stores.firstOrNull?.id;
    return null;
  }

  void select(String? storeId) => state = storeId;
}

/// Store used for new orders: the selected one, else the first accessible.
final workingStoreProvider = Provider<SessionStore?>((ref) {
  final session = ref.watch(sessionProvider);
  final id = ref.watch(selectedStoreIdProvider);
  return session.stores.where((s) => s.id == id).firstOrNull ?? session.stores.firstOrNull;
});
