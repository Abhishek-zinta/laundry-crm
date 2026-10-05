import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/domain/refs.dart';
import '../../../core/errors/app_exception.dart';

part 'garments_repository.g.dart';

@apiModel
class GarmentLineRef {
  const GarmentLineRef({required this.itemName, required this.categoryName});
  final String itemName;
  final String categoryName;

  factory GarmentLineRef.fromJson(Map<String, dynamic> json) => _$GarmentLineRefFromJson(json);
}

@apiModel
class GarmentOrderRef {
  const GarmentOrderRef({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.dueDate,
    required this.customer,
    this.rack,
  });
  final String id;
  final String orderNumber;
  final OrderStatus status;
  final DateTime dueDate;
  final CustomerRef customer;
  final RackLocation? rack;

  factory GarmentOrderRef.fromJson(Map<String, dynamic> json) => _$GarmentOrderRefFromJson(json);
}

/// An individual tagged garment with its order context.
@apiModel
class GarmentRecord {
  const GarmentRecord({
    required this.id,
    required this.tagCode,
    required this.status,
    this.color,
    this.brand,
    this.issues = const [],
    this.damageNotes,
    required this.orderLine,
    required this.order,
  });
  final String id;
  final String tagCode;
  final OrderStatus status;
  final String? color;
  final String? brand;
  final List<String> issues;
  final String? damageNotes;
  final GarmentLineRef orderLine;
  final GarmentOrderRef order;

  factory GarmentRecord.fromJson(Map<String, dynamic> json) => _$GarmentRecordFromJson(json);
}

final garmentsRepositoryProvider = Provider((ref) => GarmentsRepository(ref.watch(apiClientProvider)));

class GarmentsRepository {
  GarmentsRepository(this._api);
  final ApiClient _api;

  Future<Paged<GarmentRecord>> list({String search = '', OrderStatus? status, String? storeId, int page = 1}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/garments',
      query: {
        'q': search.trim(),
        'status': status?.wire,
        'storeId': storeId,
        'page': page,
        'pageSize': 30,
        // In-process garments first, then delivered/cancelled (most recent first).
        'sort': 'active',
      },
    );
    return Paged.fromJson(json, GarmentRecord.fromJson);
  }

  /// Exact tag lookup (typed, or later scanned from a QR/barcode label). Null when no garment has that tag.
  Future<GarmentRecord?> byTag(String tagCode) async {
    try {
      return GarmentRecord.fromJson(
        await _api.get<Map<String, dynamic>>('/garments/tag/${Uri.encodeComponent(tagCode.trim().toUpperCase())}'),
      );
    } on AppException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }
}
