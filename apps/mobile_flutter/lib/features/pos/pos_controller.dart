import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/auth/store_context.dart';
import '../../core/domain/refs.dart';
import '../catalog/data/catalog_models.dart';
import '../catalog/data/catalog_repository.dart';
import '../orders/data/order_models.dart';
import '../orders/data/orders_repository.dart';
import 'domain/cart.dart';

/// Catalog priced for the chosen customer (their price list, else the default).
final posCatalogProvider = FutureProvider.autoDispose.family<PosCatalog, ({String storeId, String? customerId})>(
  (ref, key) => ref.watch(catalogRepositoryProvider).posCatalog(storeId: key.storeId, customerId: key.customerId),
);

/// Server-computed totals for the current cart, debounced while the user edits.
final pricingPreviewProvider = FutureProvider.autoDispose.family<PricingPreview?, String>((ref, previewJson) async {
  final body = jsonDecode(previewJson) as Map<String, dynamic>;
  if ((body['lines'] as List).isEmpty) return null;
  await Future<void>.delayed(const Duration(milliseconds: 300));
  if (!ref.mounted) return null;
  return ref.read(catalogRepositoryProvider).preview(body);
});

final posControllerProvider = NotifierProvider<PosController, CartDraft?>(PosController.new);

/// True while an order is being created (drives the button spinner in the cart sheet too).
final posSubmittingProvider = NotifierProvider<PosSubmitting, bool>(PosSubmitting.new);

class PosSubmitting extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool value) => state = value;
}

/// Holds the in-progress order. Survives tab switches so a half-built order isn't lost.
class PosController extends Notifier<CartDraft?> {
  @override
  CartDraft? build() {
    final store = ref.watch(workingStoreProvider);
    if (store == null) return null;
    final hours = ref.read(sessionProvider).tenant.settings.defaultTurnaroundHours;
    return CartDraft(storeId: store.id, dueDate: defaultDueDate(hours));
  }

  void _update(CartDraft Function(CartDraft d) f) {
    final d = state;
    if (d != null) state = f(d);
  }

  void selectCustomer(CustomerRef? c) => _update((d) => d.withCustomer(c).withPriceList(null));
  void setPriceList(String id) => _update((d) => d.priceListId == id ? d : d.withPriceList(id));
  void add(PosCategory c, PosItem i) => _update((d) => d.add(c, i));
  void decrement(String categoryId, String itemId) => _update((d) => d.decrement(categoryId, itemId));
  void stepLine(String key, int dir) => _update((d) => d.stepLine(key, dir));
  void setQuantity(String key, Qty q) => _update((d) => d.setQuantity(key, q));
  void toggleModifier(String key, String modifierId) => _update((d) => d.toggleModifier(key, modifierId));
  void removeLine(String key) => _update((d) => d.removeLine(key));
  void setDiscount(CartDiscount? discount) => _update((d) => d.withDiscount(discount));
  void setDueDate(DateTime due) => _update((d) => d.withDueDate(due));
  void setPayment(CartPayment? p) => _update((d) => d.withPayment(p));

  /// Creates the order. The draft keeps its idempotency key until success,
  /// so retrying after a timeout can't create a duplicate.
  Future<OrderDetail> submit() async {
    final draft = state;
    if (draft == null || draft.blockers().isNotEmpty) throw StateError('Order is not ready');
    final order = await ref.read(ordersRepositoryProvider).create(draft);
    ref.invalidateSelf();
    return order;
  }

  void reset() => ref.invalidateSelf();
}
