import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/token_manager.dart';
import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage.dart';
import 'auth_interceptor.dart';

BaseOptions _baseOptions(AppConfig config) => BaseOptions(
  baseUrl: config.apiBaseUrl,
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 20),
  sendTimeout: const Duration(seconds: 20),
  contentType: Headers.jsonContentType,
  responseType: ResponseType.json,
  headers: {'Accept': 'application/json'},
);

/// Overridden in main() with the validated build configuration.
final appConfigProvider = Provider<AppConfig>((ref) => throw UnimplementedError('appConfigProvider must be overridden'));

final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());

/// Unauthenticated client for /mobile/auth/* token calls.
final authDioProvider = Provider<Dio>((ref) => Dio(_baseOptions(ref.watch(appConfigProvider))));

final tokenManagerProvider = Provider<TokenManager>((ref) {
  final manager = TokenManager(storage: ref.watch(tokenStorageProvider), authDio: ref.watch(authDioProvider));
  ref.onDispose(manager.dispose);
  return manager;
});

/// Authenticated client used by every repository.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions(ref.watch(appConfigProvider)));
  dio.interceptors.add(AuthInterceptor(tokens: ref.watch(tokenManagerProvider), dio: dio));
  if (kDebugMode) {
    // Method, URL and status only: headers, bodies and options can carry tokens or customer data.
    dio.interceptors.add(
      LogInterceptor(request: false, requestHeader: false, responseHeader: false, requestBody: false, responseBody: false),
    );
  }
  return dio;
});

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(dioProvider)));

/// Thin typed wrapper over Dio: every failure surfaces as [AppException].
class ApiClient {
  ApiClient(this._dio);
  final Dio _dio;

  Future<T> get<T>(String path, {Map<String, dynamic>? query, CancelToken? cancel}) =>
      _send(() => _dio.get<T>(path, queryParameters: _clean(query), cancelToken: cancel));

  Future<T> post<T>(String path, {Object? body}) => _send(() => _dio.post<T>(path, data: body ?? const {}));

  Future<T> patch<T>(String path, {Object? body}) => _send(() => _dio.patch<T>(path, data: body ?? const {}));

  Future<T> delete<T>(String path) => _send(() => _dio.delete<T>(path));

  Future<T> _send<T>(Future<Response<T>> Function() call) async {
    try {
      return (await call()).data as T;
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    return {
      for (final e in query.entries)
        if (e.value != null && e.value != '') e.key: e.value,
    };
  }
}
