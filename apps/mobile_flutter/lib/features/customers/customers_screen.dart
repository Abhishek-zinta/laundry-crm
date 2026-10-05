import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/domain/api_model.dart';
import '../../core/format/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/paged.dart';
import 'data/customer_models.dart';
import 'data/customers_repository.dart';

final customerSearchProvider = AsyncNotifierProvider.autoDispose.family<CustomerSearch, PagedState<CustomerListItem>, String>(
  CustomerSearch.new,
);

class CustomerSearch extends PagedNotifier<CustomerListItem> {
  CustomerSearch(this.query);
  final String query;

  @override
  Future<Paged<CustomerListItem>> fetch(int page) => ref.read(customersRepositoryProvider).search(query, page: page);
}

class CustomersScreen extends ConsumerWidget {
  const CustomersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = ref.watch(sessionProvider).can(Perm.customersManage);
    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      body: CustomerSearchList(onSelected: (c) => context.push(Routes.customer(c.id))),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () => context.push(Routes.newCustomer),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Add customer'),
            )
          : null,
    );
  }
}

/// Search box + paged results by name or phone. Reused by the POS customer step.
class CustomerSearchList extends ConsumerStatefulWidget {
  const CustomerSearchList({super.key, required this.onSelected, this.autofocus = false, this.footer});
  final ValueChanged<CustomerListItem> onSelected;
  final bool autofocus;

  /// Shown under the search box (e.g. "New customer" in the POS).
  final Widget? footer;

  @override
  ConsumerState<CustomerSearchList> createState() => _CustomerSearchListState();
}

class _CustomerSearchListState extends ConsumerState<CustomerSearchList> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => setState(() => _query = v.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(customerSearchProvider(_query));
    final money = ref.watch(moneyFormatProvider);
    final theme = Theme.of(context);
    return ContentWidth(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: SearchBar(
              controller: _controller,
              autoFocus: widget.autofocus,
              hintText: 'Search name or phone',
              leading: const Icon(Icons.search),
              keyboardType: TextInputType.text,
              elevation: const WidgetStatePropertyAll(0),
              trailing: [
                if (_controller.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () {
                      _controller.clear();
                      _onChanged('');
                    },
                  ),
              ],
              onChanged: _onChanged,
            ),
          ),
          ?widget.footer,
          Expanded(
            child: PagedBody(
              value: value,
              onRetry: () => ref.invalidate(customerSearchProvider(_query)),
              builder: (state) => PagedListView<CustomerListItem>(
                state: state,
                onLoadMore: () => ref.read(customerSearchProvider(_query).notifier).loadMore(),
                onRefresh: () => ref.refresh(customerSearchProvider(_query).future),
                empty: EmptyState(icon: Icons.person_search, title: _query.isEmpty ? 'No customers yet' : 'No customer matches "$_query"'),
                itemBuilder: (_, c) => ListTile(
                  onTap: () => widget.onSelected(c),
                  leading: CircleAvatar(child: Text(c.firstName.characters.first.toUpperCase())),
                  title: Text(c.fullName),
                  subtitle: Text('${c.phone} · ${c.orderCount} order${c.orderCount == 1 ? '' : 's'}'),
                  trailing: c.balance.isPositive
                      ? Text('Due ${money.format(c.balance)}', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error))
                      : null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
