import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/auth/store_context.dart';
import '../../core/domain/refs.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/store_switcher.dart';
import '../catalog/data/catalog_models.dart';
import '../customers/customers_screen.dart';
import '../customers/data/customer_models.dart';
import 'domain/cart.dart';
import 'pos_controller.dart';
import 'widgets/catalog_grid.dart';
import 'widgets/checkout_panel.dart';

/// Native counter POS. Phone: customer → catalog → cart sheet.
/// Tablet: catalog and checkout side by side.
class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  Future<void> _submit() async {
    final submitting = ref.read(posSubmittingProvider.notifier);
    if (ref.read(posSubmittingProvider)) return;
    submitting.set(true);
    try {
      final order = await ref.read(posControllerProvider.notifier).submit();
      if (!mounted) return;
      // Close the cart sheet if open, then show the new order.
      Navigator.of(context, rootNavigator: true).popUntil((r) => r is! ModalBottomSheetRoute);
      showSnack(context, 'Order ${order.orderNumber} created');
      unawaited(context.push(Routes.order(order.id)));
    } on Object catch (e) {
      if (mounted) showError(context, e);
    } finally {
      submitting.set(false);
    }
  }

  Future<void> _newCustomer() async {
    final created = await context.push<CustomerDetail>('${Routes.newCustomer}?pick=1');
    if (created != null) ref.read(posControllerProvider.notifier).selectCustomer(created);
  }

  void _openCart(List<Modifier> modifiers) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true, // cover the bottom navigation
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        builder: (context, scroll) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: CheckoutPanel(modifiers: modifiers, onSubmit: _submit, scroll: scroll),
        ),
      ),
    );
  }

  Future<bool> _confirmDiscard(CartDraft draft) async {
    if (draft.lines.isEmpty) return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Start over?'),
        content: const Text('The items in the cart will be removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Clear cart')),
        ],
      ),
    );
    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(posControllerProvider);
    final store = ref.watch(workingStoreProvider);
    if (draft == null || store == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('New order')),
        body: const EmptyState(icon: Icons.store, title: 'No store available'),
      );
    }
    final customer = draft.customer;
    return Scaffold(
      appBar: AppBar(
        title: const Text('New order'),
        actions: [
          if (draft.lines.isNotEmpty || customer != null)
            IconButton(
              tooltip: 'Start over',
              icon: const Icon(Icons.restart_alt),
              onPressed: () async {
                if (await _confirmDiscard(draft)) ref.read(posControllerProvider.notifier).reset();
              },
            ),
          const StoreSwitcher(allowAll: false),
        ],
      ),
      body: customer == null
          ? CustomerSearchList(
              autofocus: false,
              onSelected: (c) => ref.read(posControllerProvider.notifier).selectCustomer(c),
              footer: ref.watch(sessionProvider).can(Perm.customersManage)
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: OutlinedButton.icon(
                        onPressed: _newCustomer,
                        icon: const Icon(Icons.person_add_alt_1),
                        label: const Text('New customer'),
                      ),
                    )
                  : null,
            )
          : _CatalogStep(
              storeId: store.id,
              customer: customer,
              onChangeCustomer: () => ref.read(posControllerProvider.notifier).selectCustomer(null),
              onOpenCart: _openCart,
              onSubmit: _submit,
            ),
    );
  }
}

class _CatalogStep extends ConsumerWidget {
  const _CatalogStep({
    required this.storeId,
    required this.customer,
    required this.onChangeCustomer,
    required this.onOpenCart,
    required this.onSubmit,
  });
  final String storeId;
  final CustomerRef customer;
  final VoidCallback onChangeCustomer;
  final void Function(List<Modifier>) onOpenCart;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (storeId: storeId, customerId: customer.id);
    final catalog = ref.watch(posCatalogProvider(key));
    ref.listen(posCatalogProvider(key), (_, next) {
      final id = next.value?.priceList.id;
      if (id != null) ref.read(posControllerProvider.notifier).setPriceList(id);
    });

    final customerBar = Material(
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: ListTile(
        dense: true,
        leading: const Icon(Icons.person),
        title: Text(customer.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text([customer.phone, if (catalog.value != null) catalog.value!.priceList.name].join(' · ')),
        trailing: TextButton(onPressed: onChangeCustomer, child: const Text('Change')),
      ),
    );

    return AsyncBody(
      value: catalog,
      onRetry: () => ref.invalidate(posCatalogProvider(key)),
      data: (c) {
        if (isWide(context)) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Column(
                  children: [
                    customerBar,
                    Expanded(child: CatalogGrid(catalog: c)),
                  ],
                ),
              ),
              const VerticalDivider(width: 1),
              SizedBox(
                width: 420,
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: CheckoutPanel(modifiers: c.modifiers, onSubmit: onSubmit),
                ),
              ),
            ],
          );
        }
        return Stack(
          children: [
            Column(
              children: [
                customerBar,
                Expanded(child: CatalogGrid(catalog: c)),
              ],
            ),
            Positioned(left: 12, right: 12, bottom: 12, child: _CartBar(onTap: () => onOpenCart(c.modifiers))),
          ],
        );
      },
    );
  }
}

/// Floating summary on phones; opens the checkout sheet.
class _CartBar extends ConsumerWidget {
  const _CartBar({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(posControllerProvider)!;
    final money = ref.watch(moneyFormatProvider);
    final scheme = Theme.of(context).colorScheme;
    final empty = draft.lines.isEmpty;
    return Material(
      elevation: 6,
      color: empty ? scheme.surfaceContainerHighest : scheme.primary,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: empty ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(Icons.shopping_basket_outlined, color: empty ? scheme.onSurfaceVariant : scheme.onPrimary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  empty ? 'Cart is empty' : '${draft.itemCount} item${draft.itemCount == 1 ? '' : 's'} · ${draft.pieceCount} pcs',
                  style: TextStyle(color: empty ? scheme.onSurfaceVariant : scheme.onPrimary, fontWeight: FontWeight.w600),
                ),
              ),
              if (!empty) ...[
                Text(
                  '≈ ${money.format(draft.baseSubtotal)}',
                  style: TextStyle(color: scheme.onPrimary, fontWeight: FontWeight.w700),
                ),
                const SizedBox(width: 8),
                Icon(Icons.keyboard_arrow_up, color: scheme.onPrimary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
