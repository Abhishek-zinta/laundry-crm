import '../domain/api_model.dart';
import '../domain/enums.dart';
import '../format/money.dart';

part 'session_models.g.dart';

/// Permission keys granted by the server (packages/shared/src/permissions.ts).
/// The UI only hides what a user can't do; the API enforces every check.
abstract final class Perm {
  static const dashboardView = 'dashboard.view';
  static const ordersView = 'orders.view';
  static const ordersCreate = 'orders.create';
  static const ordersDiscount = 'orders.discount';
  static const ordersProcess = 'orders.process';
  static const ordersDeliver = 'orders.deliver';
  static const ordersDeliverWithBalance = 'orders.deliver_with_balance';
  static const ordersCancel = 'orders.cancel';
  static const customersView = 'customers.view';
  static const customersManage = 'customers.manage';
  static const garmentsView = 'garments.view';
  static const garmentsUpdate = 'garments.update';
  static const paymentsView = 'payments.view';
  static const paymentsCreate = 'payments.create';
  static const catalogView = 'catalog.view';
  static const racksView = 'racks.view';
  static const racksAssign = 'racks.assign';
  static const tasksViewOwn = 'tasks.view_own';
  static const tasksUpdateStatus = 'tasks.update_status';
}

@apiModel
class SessionUser {
  const SessionUser({required this.id, required this.name, required this.email, this.phone, required this.role});
  final String id;
  final String name;
  final String email;
  final String? phone;
  final Role role;

  factory SessionUser.fromJson(Map<String, dynamic> json) => _$SessionUserFromJson(json);
}

@apiModel
class SessionStore {
  const SessionStore({required this.id, required this.name, required this.code, this.phone, this.address});
  final String id;
  final String name;
  final String code;
  final String? phone;
  final String? address;

  factory SessionStore.fromJson(Map<String, dynamic> json) => _$SessionStoreFromJson(json);
}

@apiModel
class TenantSettings {
  const TenantSettings({
    required this.currency,
    required this.locale,
    required this.timezone,
    required this.brandColor,
    required this.taxName,
    required this.taxRate,
    required this.taxInclusive,
    required this.defaultTurnaroundHours,
    required this.skipQualityCheck,
    this.timeSlots = const [],
  });
  final String currency;
  final String locale;
  final String timezone;
  final String brandColor;
  final String taxName;
  final String taxRate;
  final bool taxInclusive;
  final int defaultTurnaroundHours;
  final bool skipQualityCheck;
  final List<String> timeSlots;

  factory TenantSettings.fromJson(Map<String, dynamic> json) => _$TenantSettingsFromJson(json);
}

@apiModel
class SessionTenant {
  const SessionTenant({required this.id, required this.name, required this.slug, this.phone, this.address, required this.settings});
  final String id;
  final String name;
  final String slug;
  final String? phone;
  final String? address;
  final TenantSettings settings;

  factory SessionTenant.fromJson(Map<String, dynamic> json) => _$SessionTenantFromJson(json);
}

/// GET /mobile/auth/me
@apiModel
class Session {
  const Session({required this.user, required this.permissions, required this.allStores, required this.stores, required this.tenant});
  final SessionUser user;
  final List<String> permissions;
  final bool allStores;
  final List<SessionStore> stores;
  final SessionTenant tenant;

  bool can(String permission) => permissions.contains(permission);

  bool get isDriver => user.role == Role.driver;

  MoneyFormatter get money => MoneyFormatter(currency: tenant.settings.currency, locale: tenant.settings.locale);

  factory Session.fromJson(Map<String, dynamic> json) => _$SessionFromJson(json);
}
