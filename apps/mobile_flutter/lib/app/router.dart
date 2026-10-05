import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/session_controller.dart';
import '../core/auth/session_models.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/splash_screen.dart';
import '../features/customers/add_customer_screen.dart';
import '../features/customers/customer_detail_screen.dart';
import '../features/customers/customers_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/driver/driver_screen.dart';
import '../features/garments/garments_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/payments/payments_screen.dart';
import '../features/pos/pos_screen.dart';
import '../features/racks/racks_screen.dart';
import '../features/settings/more_screen.dart';
import 'shell.dart';

abstract final class Routes {
  static const splash = '/splash';
  static const login = '/login';
  static const dashboard = '/dashboard';
  static const orders = '/orders';
  static const pos = '/pos';
  static const customers = '/customers';
  static const more = '/more';
  static const driver = '/driver';
  static const account = '/account';
  static const garments = '/garments';
  static const racks = '/racks';
  static const payments = '/payments';
  static const newCustomer = '/customers/new';

  static String order(String id) => '/orders/$id';
  static String customer(String id) => '/customers/$id';
}

/// Landing screen for a role (mirrors ROLE_HOME on the web, adapted to mobile).
String homeFor(Session s) {
  if (s.isDriver) return Routes.driver;
  if (s.can(Perm.dashboardView)) return Routes.dashboard;
  if (s.can(Perm.ordersCreate)) return Routes.pos;
  if (s.can(Perm.ordersView)) return Routes.orders;
  return Routes.more;
}

/// Permission needed to open a route; null = any signed-in user.
String? _permissionFor(String path) {
  const rules = {
    Routes.dashboard: Perm.dashboardView,
    Routes.pos: Perm.ordersCreate,
    Routes.orders: Perm.ordersView,
    Routes.customers: Perm.customersView,
    Routes.garments: Perm.garmentsView,
    Routes.racks: Perm.racksView,
    Routes.payments: Perm.paymentsView,
    Routes.driver: Perm.tasksViewOwn,
  };
  for (final e in rules.entries) {
    if (path == e.key || path.startsWith('${e.key}/')) return e.value;
  }
  return null;
}

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ValueNotifier<AuthState>(ref.read(sessionControllerProvider));
  ref.listen(sessionControllerProvider, (_, next) => auth.value = next);
  ref.onDispose(auth.dispose);

  final router = GoRouter(
    navigatorKey: _rootKey,
    initialLocation: Routes.splash,
    refreshListenable: auth,
    redirect: (context, state) {
      final path = state.matchedLocation;
      switch (auth.value) {
        case AuthRestoring() || AuthOffline():
          return path == Routes.splash ? null : Routes.splash;
        case AuthSignedOut():
          return path == Routes.login ? null : Routes.login;
        case AuthSignedIn(:final session):
          if (path == Routes.splash || path == Routes.login) return homeFor(session);
          // Drivers get the driver experience only.
          if (session.isDriver && path != Routes.driver && path != Routes.account) return Routes.driver;
          final needed = _permissionFor(path);
          if (needed != null && !session.can(needed)) return homeFor(session);
          return null;
      }
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const LoginScreen()),

      // Staff: Dashboard · Orders · New order · Customers · More
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => StaffShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.dashboard, builder: (_, _) => const DashboardScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.orders, builder: (_, _) => const OrdersScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.pos, builder: (_, _) => const PosScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.customers, builder: (_, _) => const CustomersScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.more, builder: (_, _) => const MoreScreen())],
          ),
        ],
      ),

      // Driver: Today · Account
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => DriverShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.driver, builder: (_, _) => const DriverScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: Routes.account, builder: (_, _) => const MoreScreen())],
          ),
        ],
      ),

      // Full-screen pages pushed above the shells.
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: Routes.newCustomer,
        builder: (_, state) => AddCustomerScreen(returnResult: state.uri.queryParameters['pick'] == '1'),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/customers/:id',
        builder: (_, state) => CustomerDetailScreen(customerId: state.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/orders/:id',
        builder: (_, state) => OrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.garments, builder: (_, _) => const GarmentsScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.racks, builder: (_, _) => const RacksScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: Routes.payments, builder: (_, _) => const PaymentsScreen()),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
