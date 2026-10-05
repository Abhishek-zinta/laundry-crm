import 'package:dio/dio.dart';

import '../auth/token_manager.dart';
import '../errors/app_exception.dart';

/// Request option flags understood by [AuthInterceptor].
abstract final class AuthFlags {
  /// Send without an access token (login, refresh).
  static const skipAuth = 'auth.skip';

  /// Set on the single retry after a refresh; a second 401 is returned as-is.
  static const retried = 'auth.retried';

  static const _usedToken = 'auth.usedToken';
}

/// Attaches `Authorization: Bearer <access token>` and recovers from an
/// expired token with exactly one refresh + one retry per request.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this._tokens, required this._dio});

  final TokenManager _tokens;

  /// The client this interceptor is installed on, used to replay the request.
  final Dio _dio;

  static const _refreshMargin = Duration(seconds: 30);

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra[AuthFlags.skipAuth] == true) return handler.next(options);
    var tokens = await _tokens.current();
    if (tokens != null && options.extra[AuthFlags.retried] != true && tokens.accessExpiresWithin(_refreshMargin)) {
      try {
        tokens = await _tokens.refresh();
      } on AppException {
        // Offline: send the old token; the server decides and the 401 path handles it.
      }
    }
    if (tokens != null) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      // A fingerprint, not the token: request extras can end up in debug logs.
      options.extra[AuthFlags._usedToken] = tokens.accessToken.hashCode;
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    if (err.response?.statusCode != 401 || options.extra[AuthFlags.skipAuth] == true || options.extra[AuthFlags.retried] == true) {
      return handler.next(err);
    }

    final used = options.extra[AuthFlags._usedToken];
    final current = await _tokens.current();
    final String? accessToken;
    if (current != null && used != null && current.accessToken.hashCode != used) {
      // Another request already refreshed while this one was in flight.
      accessToken = current.accessToken;
    } else if (current == null) {
      return handler.next(err);
    } else {
      try {
        accessToken = (await _tokens.refresh())?.accessToken;
      } on AppException catch (e) {
        return handler.next(err.copyWith(error: e));
      }
    }
    if (accessToken == null) return handler.next(err);

    final retry = options.copyWith(
      headers: {...options.headers, 'Authorization': 'Bearer $accessToken'},
      extra: {...options.extra, AuthFlags.retried: true},
    );
    try {
      handler.resolve(await _dio.fetch<dynamic>(retry));
    } on DioException catch (e) {
      handler.next(e);
    }
  }
}
