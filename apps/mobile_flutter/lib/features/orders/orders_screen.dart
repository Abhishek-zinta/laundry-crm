import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/store_context.dart';
import '../../core/domain/api_model.dart';
import '../../core/domain/enums.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/paged.dart';
import '../../core/widgets/store_switcher.dart';
import 'data/order_models.dart';
import 'data/orders_repository.dart';
import 'widgets/order_tile.dart';

final ordersListProvider = AsyncNotifierProvider.autoDispose.family<OrdersList, PagedState<OrderListItem>, OrderQuery>(OrdersList.new);

class OrdersList extends PagedNotifier<OrderListItem> {
  OrdersList(this.query);
  final OrderQuery query;

  @override
  Future<Paged<OrderListItem>> fetch(int page) => ref.read(ordersRepositoryProvider).list(query, page: page);
}

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  OrderQuickFilter _quick = OrderQuickFilter.all;
  OrderStatus? _status;
  String _search = '';
  Timer? _debounce;
  bool _searching = false;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _search = v));
  }

  @override
  Widget build(BuildContext context) {
    final query = OrderQuery(quick: _quick, status: _status, search: _search, storeId: ref.watch(selectedStoreIdProvider));
    final value = ref.watch(ordersListProvider(query));
    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                autofocus: true,
                decoration: const InputDecoration(hintText: 'Order no., customer or phone', border: InputBorder.none),
                onChanged: _onSearch,
              )
            : const Text('Orders'),
        actions: [
          IconButton(
            tooltip: _searching ? 'Close search' : 'Search',
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _search = '';
            }),
          ),
          if (!_searching) const StoreSwitcher(),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                for (final f in OrderQuickFilter.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(label: Text(f.label), selected: _quick == f, onSelected: (_) => setState(() => _quick = f)),
                  ),
                _StatusFilterChip(value: _status, onChanged: (s) => setState(() => _status = s)),
              ],
            ),
          ),
        ),
      ),
      body: ContentWidth(
        child: PagedBody(
          value: value,
          onRetry: () => ref.invalidate(ordersListProvider(query)),
          builder: (state) => PagedListView<OrderListItem>(
            state: state,
            onLoadMore: () => ref.read(ordersListProvider(query).notifier).loadMore(),
            onRefresh: () => ref.refresh(ordersListProvider(query).future),
            itemBuilder: (_, o) => OrderTile(o),
            empty: const EmptyState(icon: Icons.receipt_long_outlined, title: 'No orders match', message: 'Try a different filter.'),
          ),
        ),
      ),
    );
  }
}

class _StatusFilterChip extends StatelessWidget {
  const _StatusFilterChip({required this.value, required this.onChanged});
  final OrderStatus? value;
  final ValueChanged<OrderStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    // OrderStatus.unknown stands for "any": a null menu value would count as a dismiss.
    return PopupMenuButton<OrderStatus>(
      tooltip: 'Filter by status',
      onSelected: (s) => onChanged(s == OrderStatus.unknown ? null : s),
      itemBuilder: (_) => [
        const PopupMenuItem(value: OrderStatus.unknown, child: Text('Any status')),
        for (final s in OrderStatus.filterable) PopupMenuItem(value: s, child: Text(s.label)),
      ],
      child: IgnorePointer(
        child: FilterChip(
          label: Text(value?.label ?? 'Status'),
          avatar: const Icon(Icons.filter_list, size: 18),
          selected: value != null,
          onSelected: (_) {},
        ),
      ),
    );
  }
}
