import 'dart:async';

import 'package:dio/dio.dart';

import '../errors/app_exception.dart';
import '../storage/token_storage.dart';
import 'token_pair.dart';

/// Owns the current [TokenPair]: loads it from secure storage, persists new
/// pairs, and performs refresh-token rotation.
///
/// Refreshes are single-flight: concurrent callers share one in-flight
/// request. That matters because the server treats a second use of an
/// already-rotated refresh token as theft and revokes the whole session.
class TokenManager {
  TokenManager({required this._storage, required this._authDio});

  final TokenStorage _storage;

  /// Bare client (no auth interceptor) used for the refresh call itself,
  /// so a failing refresh can never recurse into another refresh.
  final Dio _authDio;

  TokenPair? _tokens;
  Future<TokenPair?>? _loading;
  Future<TokenPair?>? _refreshing;
  final _expired = StreamController<void>.broadcast();

  /// Fires when the server rejects the refresh token; credentials are already cleared.
  Stream<void> get sessionExpired => _expired.stream;

  Future<TokenPair?> current() {
    if (_tokens != null) return Future.value(_tokens);
    return _loading ??= _storage.read().then((t) {
      _tokens ??= t;
      _loading = null;
      return _tokens;
    });
  }

  Future<void> save(TokenPair tokens) async {
    _tokens = tokens;
    await _storage.write(tokens);
  }

  Future<void> clear() async {
    _tokens = null;
    _loading = null;
    await _storage.clear();
  }

  /// Exchanges the refresh token for a new pair.
  ///
  /// Returns null (after clearing credentials and emitting [sessionExpired])
  /// when the server rejects the token. Throws [AppException] for transport
  /// failures, keeping the credentials so a flaky network doesn't sign the user out.
  Future<TokenPair?> refresh() => _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<TokenPair?> _doRefresh() async {
    final tokens = await current();
    if (tokens == null) return null;
    try {
      final res = await _authDio.post<Map<String, dynamic>>('/mobile/auth/refresh', data: {'refreshToken': tokens.refreshToken});
      final next = TokenPair.fromJson(res.data!);
      await save(next);
      return next;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status != null && status >= 400 && status < 500 && status != 429) {
        await clear();
        _expired.add(null);
        return null;
      }
      throw AppException.fromDio(e);
    }
  }

  void dispose() => _expired.close();
}
