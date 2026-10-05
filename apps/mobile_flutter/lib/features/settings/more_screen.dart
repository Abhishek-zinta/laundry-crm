import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/session_controller.dart';
import '../../core/auth/session_models.dart';
import '../../core/auth/store_context.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/dialogs.dart';

/// "More" tab for staff and "Account" tab for drivers.
class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final config = ref.watch(appConfigProvider);
    final store = ref.watch(workingStoreProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(session.isDriver ? 'Account' : 'More')),
      body: ContentWidth(
        child: ListView(
          children: [
            ListTile(
              leading: CircleAvatar(radius: 24, child: Text(session.user.name.characters.first.toUpperCase())),
              title: Text(session.user.name, style: theme.textTheme.titleMedium),
              subtitle: Text('${session.user.role.label} · ${session.tenant.name}\n${session.user.email}'),
              isThreeLine: true,
            ),
            const Divider(),
            if (!session.isDriver) ...[
              if (session.can(Perm.garmentsView))
                ListTile(
                  leading: const Icon(Icons.checkroom),
                  title: const Text('Garments & tags'),
                  onTap: () => context.push(Routes.garments),
                ),
              if (session.can(Perm.racksView))
                ListTile(leading: const Icon(Icons.shelves), title: const Text('Racks'), onTap: () => context.push(Routes.racks)),
              if (session.can(Perm.paymentsView))
                ListTile(
                  leading: const Icon(Icons.payments_outlined),
                  title: const Text("Today's payments"),
                  onTap: () => context.push(Routes.payments),
                ),
              if (session.stores.length > 1)
                ListTile(
                  leading: const Icon(Icons.storefront_outlined),
                  title: const Text('Working store'),
                  subtitle: Text(
                    ref.watch(selectedStoreIdProvider) == null ? 'All stores (${store?.name} for new orders)' : store?.name ?? '',
                  ),
                  onTap: () => _pickStore(context, ref, session),
                ),
              const Divider(),
            ],
            ListTile(
              leading: Icon(Icons.logout, color: theme.colorScheme.error),
              title: Text('Sign out', style: TextStyle(color: theme.colorScheme.error)),
              onTap: () async {
                final ok = await confirmDialog(
                  context,
                  title: 'Sign out?',
                  message: 'You will need your password to sign in again.',
                  action: 'Sign out',
                );
                if (ok) await ref.read(sessionControllerProvider.notifier).logout();
              },
            ),
            const SizedBox(height: 24),
            Center(
              child: Text(
                'RinseOps · ${config.environment.name}${config.isDevelopment ? '\n${config.apiBaseUrl}' : ''}',
                textAlign: TextAlign.center,
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Future<void> _pickStore(BuildContext context, WidgetRef ref, Session session) async {
    final current = ref.read(selectedStoreIdProvider);
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: RadioGroup<String>(
          groupValue: current ?? '',
          onChanged: (v) => Navigator.pop(context, v),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (session.allStores) const RadioListTile(value: '', title: Text('All stores')),
              for (final s in session.stores)
                RadioListTile(value: s.id, title: Text(s.name), subtitle: s.address == null ? null : Text(s.address!)),
            ],
          ),
        ),
      ),
    );
    if (picked != null) ref.read(selectedStoreIdProvider.notifier).select(picked.isEmpty ? null : picked);
  }
}
