// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionUser _$SessionUserFromJson(Map<String, dynamic> json) => SessionUser(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String,
  phone: json['phone'] as String?,
  role: const RoleConverter().fromJson(json['role'] as String),
);

SessionStore _$SessionStoreFromJson(Map<String, dynamic> json) => SessionStore(
  id: json['id'] as String,
  name: json['name'] as String,
  code: json['code'] as String,
  phone: json['phone'] as String?,
  address: json['address'] as String?,
);

TenantSettings _$TenantSettingsFromJson(Map<String, dynamic> json) =>
    TenantSettings(
      currency: json['currency'] as String,
      locale: json['locale'] as String,
      timezone: json['timezone'] as String,
      brandColor: json['brandColor'] as String,
      taxName: json['taxName'] as String,
      taxRate: json['taxRate'] as String,
      taxInclusive: json['taxInclusive'] as bool,
      defaultTurnaroundHours: (json['defaultTurnaroundHours'] as num).toInt(),
      skipQualityCheck: json['skipQualityCheck'] as bool,
      timeSlots:
          (json['timeSlots'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
    );

SessionTenant _$SessionTenantFromJson(Map<String, dynamic> json) =>
    SessionTenant(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      phone: json['phone'] as String?,
      address: json['address'] as String?,
      settings: TenantSettings.fromJson(
        json['settings'] as Map<String, dynamic>,
      ),
    );

Session _$SessionFromJson(Map<String, dynamic> json) => Session(
  user: SessionUser.fromJson(json['user'] as Map<String, dynamic>),
  permissions: (json['permissions'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  allStores: json['allStores'] as bool,
  stores: (json['stores'] as List<dynamic>)
      .map((e) => SessionStore.fromJson(e as Map<String, dynamic>))
      .toList(),
  tenant: SessionTenant.fromJson(json['tenant'] as Map<String, dynamic>),
);
