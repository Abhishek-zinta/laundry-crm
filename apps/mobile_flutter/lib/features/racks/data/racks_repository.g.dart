// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'racks_repository.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SlotOrder _$SlotOrderFromJson(Map<String, dynamic> json) => SlotOrder(
  id: json['id'] as String,
  orderNumber: json['orderNumber'] as String,
  status: const OrderStatusConverter().fromJson(json['status'] as String),
  balanceDue: const MoneyConverter().fromJson(json['balanceDue'] as String),
  totalPieces: (json['totalPieces'] as num).toInt(),
  customerName: json['customerName'] as String,
);

RackSlot _$RackSlotFromJson(Map<String, dynamic> json) => RackSlot(
  id: json['id'] as String,
  code: json['code'] as String,
  capacity: (json['capacity'] as num).toInt(),
  isActive: json['isActive'] as bool,
  available: json['available'] as bool,
  orders: (json['orders'] as List<dynamic>)
      .map((e) => SlotOrder.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Rack _$RackFromJson(Map<String, dynamic> json) => Rack(
  id: json['id'] as String,
  name: json['name'] as String,
  code: json['code'] as String,
  isActive: json['isActive'] as bool,
  slots: (json['slots'] as List<dynamic>)
      .map((e) => RackSlot.fromJson(e as Map<String, dynamic>))
      .toList(),
);

RackStats _$RackStatsFromJson(Map<String, dynamic> json) => RackStats(
  slots: (json['slots'] as num).toInt(),
  occupied: (json['occupied'] as num).toInt(),
);

RackBoard _$RackBoardFromJson(Map<String, dynamic> json) => RackBoard(
  racks: (json['racks'] as List<dynamic>)
      .map((e) => Rack.fromJson(e as Map<String, dynamic>))
      .toList(),
  stats: RackStats.fromJson(json['stats'] as Map<String, dynamic>),
);
