// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'refs.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CustomerRef _$CustomerRefFromJson(Map<String, dynamic> json) => CustomerRef(
  id: json['id'] as String,
  firstName: json['firstName'] as String,
  lastName: json['lastName'] as String?,
  phone: json['phone'] as String,
);

StoreRef _$StoreRefFromJson(Map<String, dynamic> json) => StoreRef(
  id: json['id'] as String,
  name: json['name'] as String,
  code: json['code'] as String?,
);

UserRef _$UserRefFromJson(Map<String, dynamic> json) =>
    UserRef(id: json['id'] as String, name: json['name'] as String);

RackLocation _$RackLocationFromJson(Map<String, dynamic> json) => RackLocation(
  slotId: json['slotId'] as String,
  slotCode: json['slotCode'] as String,
  rackId: json['rackId'] as String,
  rackName: json['rackName'] as String,
  rackCode: json['rackCode'] as String,
);
