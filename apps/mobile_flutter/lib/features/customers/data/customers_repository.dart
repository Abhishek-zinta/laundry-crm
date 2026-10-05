import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/api_model.dart';
import 'customer_models.dart';

final customersRepositoryProvider = Provider<CustomersRepository>((ref) => ApiCustomersRepository(ref.watch(apiClientProvider)));

/// Customers data source; cache-ready (see OrdersRepository).
abstract interface class CustomersRepository {
  /// Searches by name, phone or email.
  Future<Paged<CustomerListItem>> search(String query, {int page = 1, int pageSize = 25});
  Future<CustomerDetail> get(String id);
  Future<CustomerDetail> create(NewCustomer customer);
}

class ApiCustomersRepository implements CustomersRepository {
  ApiCustomersRepository(this._api);
  final ApiClient _api;

  @override
  Future<Paged<CustomerListItem>> search(String query, {int page = 1, int pageSize = 25}) async {
    final json = await _api.get<Map<String, dynamic>>(
      '/customers',
      query: {'q': query.trim(), 'page': page, 'pageSize': pageSize, 'sort': query.trim().isEmpty ? 'recent' : 'name'},
    );
    return Paged.fromJson(json, CustomerListItem.fromJson);
  }

  @override
  Future<CustomerDetail> get(String id) async => CustomerDetail.fromJson(await _api.get<Map<String, dynamic>>('/customers/$id'));

  @override
  Future<CustomerDetail> create(NewCustomer customer) async =>
      CustomerDetail.fromJson(await _api.post<Map<String, dynamic>>('/customers', body: customer.toJson()));
}
