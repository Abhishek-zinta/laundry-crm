import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/format/money.dart';

part 'racks_repository.g.dart';

@apiModel
class SlotOrder {
  const SlotOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.balanceDue,
    required this.totalPieces,
    required this.customerName,
  });
  final String id;
  final String orderNumber;
  final OrderStatus status;
  final Money balanceDue;
  final int totalPieces;
  final String customerName;

  factory SlotOrder.fromJson(Map<String, dynamic> json) => _$SlotOrderFromJson(json);
}

@apiModel
class RackSlot {
  const RackSlot({
    required this.id,
    required this.code,
    required this.capacity,
    required this.isActive,
    required this.available,
    required this.orders,
  });
  final String id;
  final String code;
  final int capacity;
  final bool isActive;
  final bool available;
  final List<SlotOrder> orders;

  factory RackSlot.fromJson(Map<String, dynamic> json) => _$RackSlotFromJson(json);
}

@apiModel
class Rack {
  const Rack({required this.id, required this.name, required this.code, required this.isActive, required this.slots});
  final String id;
  final String name;
  final String code;
  final bool isActive;
  final List<RackSlot> slots;

  factory Rack.fromJson(Map<String, dynamic> json) => _$RackFromJson(json);
}

@apiModel
class RackStats {
  const RackStats({required this.slots, required this.occupied});
  final int slots;
  final int occupied;

  factory RackStats.fromJson(Map<String, dynamic> json) => _$RackStatsFromJson(json);
}

@apiModel
class RackBoard {
  const RackBoard({required this.racks, required this.stats});
  final List<Rack> racks;
  final RackStats stats;

  factory RackBoard.fromJson(Map<String, dynamic> json) => _$RackBoardFromJson(json);
}

final racksRepositoryProvider = Provider((ref) => RacksRepository(ref.watch(apiClientProvider)));

class RacksRepository {
  RacksRepository(this._api);
  final ApiClient _api;

  Future<RackBoard> board({String? storeId}) async =>
      RackBoard.fromJson(await _api.get<Map<String, dynamic>>('/racks', query: {'storeId': storeId}));
}
