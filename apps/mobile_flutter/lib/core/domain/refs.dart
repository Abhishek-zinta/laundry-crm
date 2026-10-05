import 'api_model.dart';

part 'refs.g.dart';

@apiModel
class CustomerRef {
  const CustomerRef({required this.id, required this.firstName, this.lastName, required this.phone});
  final String id;
  final String firstName;
  final String? lastName;
  final String phone;

  String get fullName => [firstName, lastName].whereType<String>().where((s) => s.isNotEmpty).join(' ');

  factory CustomerRef.fromJson(Map<String, dynamic> json) => _$CustomerRefFromJson(json);
}

@apiModel
class StoreRef {
  const StoreRef({required this.id, required this.name, this.code});
  final String id;
  final String name;
  final String? code;

  factory StoreRef.fromJson(Map<String, dynamic> json) => _$StoreRefFromJson(json);
}

@apiModel
class UserRef {
  const UserRef({required this.id, required this.name});
  final String id;
  final String name;

  factory UserRef.fromJson(Map<String, dynamic> json) => _$UserRefFromJson(json);
}

@apiModel
class RackLocation {
  const RackLocation({required this.slotId, required this.slotCode, required this.rackId, required this.rackName, required this.rackCode});
  final String slotId;
  final String slotCode;
  final String rackId;
  final String rackName;
  final String rackCode;

  factory RackLocation.fromJson(Map<String, dynamic> json) => _$RackLocationFromJson(json);
}
