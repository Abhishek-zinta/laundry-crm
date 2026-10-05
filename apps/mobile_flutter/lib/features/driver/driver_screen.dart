import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/auth/session_controller.dart';
import '../../core/domain/enums.dart';
import '../../core/domain/workflow.dart';
import '../../core/format/formatters.dart';
import '../../core/util/launch.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/dialogs.dart';
import 'data/task_models.dart';
import 'data/tasks_repository.dart';

final myTasksProvider = FutureProvider.autoDispose<List<DriverTask>>((ref) => ref.watch(tasksRepositoryProvider).myTasks());

/// Driver home: today's pickups and deliveries, open ones first.
class DriverScreen extends ConsumerWidget {
  const DriverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final value = ref.watch(myTasksProvider);
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Today's tasks"),
            Text('${session.user.name} · ${Fmt.weekdayDate()}', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
      body: ContentWidth(
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(myTasksProvider.future),
          child: AsyncBody(
            value: value,
            onRetry: () => ref.invalidate(myTasksProvider),
            data: (tasks) {
              if (tasks.isEmpty) {
                return ListView(
                  children: const [
                    SizedBox(
                      height: 400,
                      child: EmptyState(icon: Icons.local_shipping_outlined, title: 'No tasks today', message: 'Pull down to refresh.'),
                    ),
                  ],
                );
              }
              final open = tasks.where((t) => t.status.isOpen).toList();
              final closed = tasks.where((t) => !t.status.isOpen).toList();
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _Summary(tasks: tasks),
                  if (open.isNotEmpty) const SectionHeader('To do'),
                  for (final t in open)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TaskCard(task: t),
                    ),
                  if (closed.isNotEmpty) const SectionHeader('Done'),
                  for (final t in closed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TaskCard(task: t),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.tasks});
  final List<DriverTask> tasks;

  @override
  Widget build(BuildContext context) {
    final pickups = tasks.where((t) => t.type == TaskType.pickup).length;
    final deliveries = tasks.length - pickups;
    final done = tasks.where((t) => t.status.isDone).length;
    final theme = Theme.of(context);
    Widget stat(String label, String value) => Expanded(
      child: Column(
        children: [
          Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          Text(label, style: theme.textTheme.bodySmall),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(children: [stat('Pickups', '$pickups'), stat('Deliveries', '$deliveries'), stat('Done', '$done/${tasks.length}')]),
      ),
    );
  }
}

class TaskCard extends ConsumerStatefulWidget {
  const TaskCard({super.key, required this.task});
  final DriverTask task;

  @override
  ConsumerState<TaskCard> createState() => _TaskCardState();
}

class _TaskCardState extends ConsumerState<TaskCard> {
  bool _busy = false;

  Future<void> _act(DriverAction action) async {
    final t = widget.task;
    String? note;
    if (action == DriverAction.failed) {
      note = await askText(
        context,
        title: 'What went wrong?',
        label: 'Reason (e.g. customer not home)',
        action: 'Mark failed',
        minLength: 3,
      );
      if (note == null) return;
    } else if (action != DriverAction.start) {
      final ok = await confirmDialog(
        context,
        title: '${action.label}?',
        message: '${t.type.label} for ${t.customer.fullName}',
        action: action.label,
      );
      if (!ok) return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(tasksRepositoryProvider).changeStatus(t.id, targetStatus(t.type, action), note: note);
      ref.invalidate(myTasksProvider);
      if (mounted) showSnack(context, '${t.type.label}: ${targetStatus(t.type, action).label}');
    } on Object catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.task;
    final theme = Theme.of(context);
    final money = ref.watch(moneyFormatProvider);
    final actions = driverActionsFor(t.type, t.status);
    final isPickup = t.type == TaskType.pickup;
    final typeColors = isPickup
        ? StatusColors.order(theme.colorScheme, OrderStatus.received)
        : StatusColors.order(theme.colorScheme, OrderStatus.ready);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Pill(label: t.type.label, colors: typeColors, icon: isPickup ? Icons.north_east : Icons.south_west),
                const SizedBox(width: 8),
                TaskStatusPill(t.status),
                const Spacer(),
                Icon(Icons.schedule, size: 16, color: theme.colorScheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Text(t.timeSlot, style: theme.textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 12),
            Text(t.customer.fullName, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            InkWell(
              onTap: () => dialPhone(t.customer.phone),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Icon(Icons.call, size: 18, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      t.customer.phone,
                      style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
            InkWell(
              onTap: () => openMaps(t.address),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.place, size: 18, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(t.address, style: TextStyle(color: theme.colorScheme.primary)),
                    ),
                    Icon(Icons.open_in_new, size: 16, color: theme.colorScheme.primary),
                  ],
                ),
              ),
            ),
            if (t.order != null)
              Text(
                '${t.order!.orderNumber} · ${t.order!.totalPieces} pcs${t.order!.balanceDue.isPositive ? ' · collect ${money.format(t.order!.balanceDue)}' : ''}',
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: t.order!.balanceDue.isPositive ? FontWeight.w600 : null),
              ),
            if (t.requestedService != null) Text('Service: ${t.requestedService}', style: theme.textTheme.bodyMedium),
            if (t.notes != null) Text(t.notes!, style: theme.textTheme.bodySmall),
            if (t.failureReason != null) Text('Failed: ${t.failureReason}', style: TextStyle(color: theme.colorScheme.error)),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  for (var i = 0; i < actions.length; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    Expanded(
                      child: actions[i] == DriverAction.failed
                          ? OutlinedButton(onPressed: _busy ? null : () => _act(actions[i]), child: Text(actions[i].label))
                          : FilledButton(
                              onPressed: _busy ? null : () => _act(actions[i]),
                              child: _busy
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                  : Text(actions[i] == DriverAction.start ? 'Start ${t.type.label.toLowerCase()}' : actions[i].label),
                            ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
