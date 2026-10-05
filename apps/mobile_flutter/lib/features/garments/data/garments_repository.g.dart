// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'garments_repository.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GarmentLineRef _$GarmentLineRefFromJson(Map<String, dynamic> json) =>
    GarmentLineRef(
      itemName: json['itemName'] as String,
      categoryName: json['categoryName'] as String,
    );

GarmentOrderRef _$GarmentOrderRefFromJson(Map<String, dynamic> json) =>
    GarmentOrderRef(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: const OrderStatusConverter().fromJson(json['status'] as String),
      dueDate: DateTime.parse(json['dueDate'] as String),
      customer: CustomerRef.fromJson(json['customer'] as Map<String, dynamic>),
      rack: json['rack'] == null
          ? null
          : RackLocation.fromJson(json['rack'] as Map<String, dynamic>),
    );

GarmentRecord _$GarmentRecordFromJson(
  Map<String, dynamic> json,
) => GarmentRecord(
  id: json['id'] as String,
  tagCode: json['tagCode'] as String,
  status: const OrderStatusConverter().fromJson(json['status'] as String),
  color: json['color'] as String?,
  brand: json['brand'] as String?,
  issues:
      (json['issues'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const [],
  damageNotes: json['damageNotes'] as String?,
  orderLine: GarmentLineRef.fromJson(json['orderLine'] as Map<String, dynamic>),
  order: GarmentOrderRef.fromJson(json['order'] as Map<String, dynamic>),
);
