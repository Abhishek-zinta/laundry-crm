import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/enums.dart';
import '../../../core/format/formatters.dart';
import '../../catalog/data/catalog_models.dart';
import '../domain/cart.dart';
import '../pos_controller.dart';

/// Service category chips + item tiles. Tap a tile to add one; the badge
/// shows the quantity in the cart and "−" removes one.
class CatalogGrid extends ConsumerStatefulWidget {
  const CatalogGrid({super.key, required this.catalog});
  final PosCatalog catalog;

  @override
  ConsumerState<CatalogGrid> createState() => _CatalogGridState();
}

class _CatalogGridState extends ConsumerState<CatalogGrid> {
  int _category = 0;

  @override
  Widget build(BuildContext context) {
    final categories = widget.catalog.categories.where((c) => c.items.isNotEmpty).toList();
    if (categories.isEmpty) return const Center(child: Text('No services are priced for this store yet.'));
    final category = categories[_category.clamp(0, categories.length - 1)];
    final width = MediaQuery.sizeOf(context).width;
    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            itemCount: categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) =>
                ChoiceChip(label: Text(categories[i].name), selected: i == _category, onSelected: (_) => setState(() => _category = i)),
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 120),
            gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: width >= 600 ? 200 : 180,
              mainAxisExtent: 128,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: category.items.length,
            itemBuilder: (_, i) => _ItemTile(category: category, item: category.items[i]),
          ),
        ),
      ],
    );
  }
}

class _ItemTile extends ConsumerWidget {
  const _ItemTile({required this.category, required this.item});
  final PosCategory category;
  final PosItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final qty = ref.watch(posControllerProvider.select((d) => d?.quantityOf(category.id, item.serviceItemId) ?? const Qty(0)));
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    final inCart = qty.milli > 0;
    final controller = ref.read(posControllerProvider.notifier);
    return Material(
      color: inCart ? theme.colorScheme.primaryContainer : theme.colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: inCart ? theme.colorScheme.primary : theme.colorScheme.outlineVariant, width: inCart ? 2 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => controller.add(category, item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Text(
                '${money.format(item.price)}${item.unitType == UnitType.piece ? '' : ' / ${item.unitType.label}'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 6),
              SizedBox(
                height: 32,
                child: inCart
                    ? Row(
                        children: [
                          Flexible(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(999)),
                                child: Text(
                                  '× ${qty.toApi()}${item.unitType == UnitType.kg ? ' kg' : ''}',
                                  style: TextStyle(color: theme.colorScheme.onPrimary, fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Spacer(),
                          IconButton.filledTonal(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints.tightFor(width: 32, height: 32),
                            tooltip: 'Remove one',
                            iconSize: 18,
                            icon: const Icon(Icons.remove),
                            onPressed: () => controller.decrement(category.id, item.serviceItemId),
                          ),
                        ],
                      )
                    : Align(
                        alignment: Alignment.centerLeft,
                        child: Icon(Icons.add_circle_outline, size: 22, color: theme.colorScheme.primary),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
