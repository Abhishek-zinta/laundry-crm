import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'catalog_models.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) => ApiCatalogRepository(ref.watch(apiClientProvider)));

/// Catalog data source; cache-ready (see OrdersRepository). The POS catalog
/// changes rarely, which makes it the first candidate for offline caching.
abstract interface class CatalogRepository {
  /// Price list resolved for this customer (their own list, else the store/tenant default).
  Future<PosCatalog> posCatalog({required String storeId, String? customerId});

  /// Server-computed totals for a cart; the server is the source of truth for tax and discounts.
  Future<PricingPreview> preview(Map<String, dynamic> body);
}

class ApiCatalogRepository implements CatalogRepository {
  ApiCatalogRepository(this._api);
  final ApiClient _api;

  @override
  Future<PosCatalog> posCatalog({required String storeId, String? customerId}) async =>
      PosCatalog.fromJson(await _api.get<Map<String, dynamic>>('/catalog/pos', query: {'storeId': storeId, 'customerId': customerId}));

  @override
  Future<PricingPreview> preview(Map<String, dynamic> body) async =>
      PricingPreview.fromJson(await _api.post<Map<String, dynamic>>('/catalog/preview', body: body));
}
