import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/store_context.dart';
import '../../core/domain/api_model.dart';
import '../../core/domain/enums.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/paged.dart';
import 'data/garments_repository.dart';
import 'domain/tag_scanner.dart';

typedef GarmentQuery = ({String search, OrderStatus? status, String? storeId});

final garmentsListProvider = AsyncNotifierProvider.autoDispose.family<GarmentsList, PagedState<GarmentRecord>, GarmentQuery>(
  GarmentsList.new,
);

class GarmentsList extends PagedNotifier<GarmentRecord> {
  GarmentsList(this.query);
  final GarmentQuery query;

  @override
  Future<Paged<GarmentRecord>> fetch(int page) =>
      ref.read(garmentsRepositoryProvider).list(search: query.search, status: query.status, storeId: query.storeId, page: page);
}

/// Individual garment tags. Exact tag lookup goes through [TagScanner]
/// (manual entry today, camera scanning later).
class GarmentsScreen extends ConsumerStatefulWidget {
  const GarmentsScreen({super.key});

  @override
  ConsumerState<GarmentsScreen> createState() => _GarmentsScreenState();
}

class _GarmentsScreenState extends ConsumerState<GarmentsScreen> {
  String _search = '';
  OrderStatus? _status;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _lookupTag() async {
    final scanner = ref.read(tagScannerProvider);
    final code = await scanner.scan(context);
    if (code == null || !mounted) return;
    try {
      final garment = await ref.read(garmentsRepositoryProvider).byTag(code);
      if (!mounted) return;
      if (garment == null) {
        showSnack(context, 'No garment found with tag ${code.toUpperCase()}', error: true);
      } else {
        await _showGarment(garment);
      }
    } on Object catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _showGarment(GarmentRecord g) {
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => _GarmentSheet(garment: g),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scanner = ref.watch(tagScannerProvider);
    final query = (search: _search, status: _status, storeId: ref.watch(selectedStoreIdProvider));
    final value = ref.watch(garmentsListProvider(query));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Garments'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(116),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: SearchBar(
                  hintText: 'Search tag, order or customer',
                  leading: const Icon(Icons.search),
                  elevation: const WidgetStatePropertyAll(0),
                  onChanged: (v) {
                    _debounce?.cancel();
                    _debounce = Timer(const Duration(milliseconds: 300), () => setState(() => _search = v.trim()));
                  },
                ),
              ),
              SizedBox(
                height: 48,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  children: [
                    for (final s in <OrderStatus?>[null, ...OrderStatus.stages.take(4)])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(s?.label ?? 'All'),
                          selected: _status == s,
                          onSelected: (_) => setState(() => _status = s),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _lookupTag,
        icon: Icon(scanner.usesCamera ? Icons.qr_code_scanner : Icons.sell_outlined),
        label: Text(scanner.usesCamera ? 'Scan tag' : 'Find tag'),
      ),
      body: ContentWidth(
        child: PagedBody(
          value: value,
          onRetry: () => ref.invalidate(garmentsListProvider(query)),
          builder: (state) => PagedListView<GarmentRecord>(
            state: state,
            onLoadMore: () => ref.read(garmentsListProvider(query).notifier).loadMore(),
            onRefresh: () => ref.refresh(garmentsListProvider(query).future),
            empty: const EmptyState(icon: Icons.checkroom, title: 'No garments match'),
            itemBuilder: (_, g) => ListTile(
              onTap: () => _showGarment(g),
              leading: const Icon(Icons.checkroom),
              title: Text(
                g.tagCode,
                style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
              ),
              subtitle: Text(
                '${g.orderLine.itemName} · ${g.orderLine.categoryName}\n${g.order.orderNumber} · ${g.order.customer.fullName}',
              ),
              isThreeLine: true,
              trailing: OrderStatusPill(g.status),
            ),
          ),
        ),
      ),
    );
  }
}

class _GarmentSheet extends StatelessWidget {
  const _GarmentSheet({required this.garment});
  final GarmentRecord garment;

  @override
  Widget build(BuildContext context) {
    final g = garment;
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(g.tagCode, style: theme.textTheme.headlineSmall),
                const Spacer(),
                OrderStatusPill(g.status),
              ],
            ),
            const SizedBox(height: 8),
            InfoRow('Item', '${g.orderLine.itemName} · ${g.orderLine.categoryName}'),
            if (g.color != null || g.brand != null) InfoRow('Details', [g.color, g.brand].whereType<String>().join(' · ')),
            if (g.issues.isNotEmpty) InfoRow('Issues', g.issues.map((i) => i.toLowerCase().replaceAll('_', ' ')).join(', ')),
            InfoRow('Order', g.order.orderNumber),
            InfoRow('Customer', g.order.customer.fullName),
            InfoRow('Due', Fmt.relativeDue(g.order.dueDate)),
            InfoRow('Rack', g.order.rack?.slotCode ?? '—'),
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: () {
                Navigator.pop(context);
                context.push(Routes.order(g.order.id));
              },
              icon: const Icon(Icons.receipt_long),
              label: const Text('Open order'),
            ),
          ],
        ),
      ),
    );
  }
}
