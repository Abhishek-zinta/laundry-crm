import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/session_controller.dart';
import '../core/auth/session_models.dart';
import '../core/network/connectivity.dart';
import '../core/widgets/brand_mark.dart';
import '../core/widgets/common.dart';

class _Destination {
  const _Destination(this.branch, this.label, this.icon, this.selectedIcon, [this.permission]);
  final int branch;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String? permission;
}

const _staffDestinations = [
  _Destination(0, 'Dashboard', Icons.space_dashboard_outlined, Icons.space_dashboard, Perm.dashboardView),
  _Destination(1, 'Orders', Icons.receipt_long_outlined, Icons.receipt_long, Perm.ordersView),
  _Destination(2, 'New order', Icons.add_circle_outline, Icons.add_circle, Perm.ordersCreate),
  _Destination(3, 'Customers', Icons.people_outline, Icons.people, Perm.customersView),
  _Destination(4, 'More', Icons.menu, Icons.menu),
];

const _driverDestinations = [
  _Destination(0, 'Today', Icons.local_shipping_outlined, Icons.local_shipping),
  _Destination(1, 'Account', Icons.person_outline, Icons.person),
];

class StaffShell extends ConsumerWidget {
  const StaffShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final visible = _staffDestinations.where((d) => d.permission == null || session.can(d.permission!)).toList();
    return _AdaptiveShell(shell: shell, destinations: visible);
  }
}

class DriverShell extends StatelessWidget {
  const DriverShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => _AdaptiveShell(shell: shell, destinations: _driverDestinations);
}

/// Bottom NavigationBar on phones, NavigationRail on tablets.
class _AdaptiveShell extends StatelessWidget {
  const _AdaptiveShell({required this.shell, required this.destinations});
  final StatefulNavigationShell shell;
  final List<_Destination> destinations;

  @override
  Widget build(BuildContext context) {
    final selected = destinations.indexWhere((d) => d.branch == shell.currentIndex).clamp(0, destinations.length - 1);
    void onSelect(int i) {
      final branch = destinations[i].branch;
      shell.goBranch(branch, initialLocation: branch == shell.currentIndex);
    }

    final body = Column(
      children: [
        const OfflineBanner(),
        Expanded(child: shell),
      ],
    );

    if (isMedium(context)) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: selected,
              onDestinationSelected: onSelect,
              labelType: NavigationRailLabelType.all,
              extended: false,
              leading: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: const BrandMark(size: 36)),
              destinations: [
                for (final d in destinations)
                  NavigationRailDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon), label: Text(d.label)),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ],
        ),
      );
    }
    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: onSelect,
        destinations: [
          for (final d in destinations) NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon), label: d.label),
        ],
      ),
    );
  }
}
