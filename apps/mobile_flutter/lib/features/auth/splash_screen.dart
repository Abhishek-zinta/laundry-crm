import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/session_controller.dart';
import '../../core/widgets/brand_mark.dart';

/// Shown while a stored session is being restored, or when the server
/// can't be reached to verify it (credentials are kept in that case).
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sessionControllerProvider);
    final theme = Theme.of(context);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandMark(size: 72),
              const SizedBox(height: 16),
              Text('RinseOps', style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 32),
              if (state is AuthOffline) ...[
                Text(state.error.message, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => ref.read(sessionControllerProvider.notifier).restore(),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try again'),
                ),
                TextButton(onPressed: () => ref.read(sessionControllerProvider.notifier).logout(), child: const Text('Sign out')),
              ] else
                const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
