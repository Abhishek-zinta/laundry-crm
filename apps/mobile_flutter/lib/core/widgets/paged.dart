import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/api_model.dart';
import 'common.dart';

class PagedState<T> {
  const PagedState({required this.items, required this.total, required this.page, required this.hasMore, this.loadingMore = false});
  final List<T> items;
  final int total;
  final int page;
  final bool hasMore;
  final bool loadingMore;

  PagedState<T> copyWith({bool? loadingMore}) =>
      PagedState(items: items, total: total, page: page, hasMore: hasMore, loadingMore: loadingMore ?? this.loadingMore);
}

/// Infinite-scroll list state: first page in [build], further pages on [loadMore].
abstract class PagedNotifier<T> extends AsyncNotifier<PagedState<T>> {
  Future<Paged<T>> fetch(int page);

  @override
  Future<PagedState<T>> build() async {
    final first = await fetch(1);
    return PagedState(items: first.items, total: first.total, page: 1, hasMore: first.hasMore);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final next = await fetch(current.page + 1);
      if (!ref.mounted) return;
      state = AsyncData(
        PagedState(items: [...current.items, ...next.items], total: next.total, page: current.page + 1, hasMore: next.hasMore),
      );
    } on Object {
      if (ref.mounted) state = AsyncData(current.copyWith(loadingMore: false));
    }
  }
}

/// ListView that asks for the next page near the end.
class PagedListView<T> extends StatelessWidget {
  const PagedListView({
    super.key,
    required this.state,
    required this.itemBuilder,
    required this.onLoadMore,
    required this.onRefresh,
    required this.empty,
    this.separated = true,
    this.header,
  });

  final PagedState<T> state;
  final Widget Function(BuildContext, T) itemBuilder;
  final VoidCallback onLoadMore;
  final Future<void> Function() onRefresh;
  final Widget empty;
  final bool separated;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final items = state.items;
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: items.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                ?header,
                SizedBox(height: 360, child: empty),
              ],
            )
          : NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) onLoadMore();
                return false;
              },
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.only(bottom: 96),
                itemCount: items.length + 1 + (header == null ? 0 : 1),
                itemBuilder: (context, i) {
                  if (header != null) {
                    if (i == 0) return header!;
                    i -= 1;
                  }
                  if (i == items.length) {
                    return state.hasMore
                        ? const Padding(
                            padding: EdgeInsets.all(24),
                            child: Center(child: CircularProgressIndicator()),
                          )
                        : const SizedBox(height: 24);
                  }
                  final tile = itemBuilder(context, items[i]);
                  return separated && i > 0 ? Column(children: [const Divider(height: 1), tile]) : tile;
                },
              ),
            ),
    );
  }
}

/// Shows a [PagedNotifier]'s AsyncValue with shared loading/error handling.
class PagedBody<T> extends StatelessWidget {
  const PagedBody({super.key, required this.value, required this.builder, required this.onRetry});
  final AsyncValue<PagedState<T>> value;
  final Widget Function(PagedState<T>) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => AsyncBody(value: value, data: builder, onRetry: onRetry);
}
