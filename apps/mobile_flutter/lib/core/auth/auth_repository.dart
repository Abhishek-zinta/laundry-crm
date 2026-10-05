import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../errors/app_exception.dart';
import 'session_models.dart';
import 'token_manager.dart';
import 'token_pair.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) =>
      ApiAuthRepository(authDio: ref.watch(authDioProvider), api: ref.watch(apiClientProvider), tokens: ref.watch(tokenManagerProvider)),
);

abstract interface class AuthRepository {
  /// True when credentials are stored on the device.
  Future<bool> hasCredentials();
  Future<void> login(String email, String password);
  Future<Session> me();

  /// Revokes the refresh session server-side (best effort) and clears local credentials.
  Future<void> logout();
  Stream<void> get sessionExpired;
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({required this._authDio, required this._api, required this._tokens});

  final Dio _authDio;
  final ApiClient _api;
  final TokenManager _tokens;

  @override
  Stream<void> get sessionExpired => _tokens.sessionExpired;

  @override
  Future<bool> hasCredentials() async => await _tokens.current() != null;

  @override
  Future<void> login(String email, String password) async {
    try {
      final res = await _authDio.post<Map<String, dynamic>>(
        '/mobile/auth/login',
        data: {'email': email.trim(), 'password': password, 'deviceName': _deviceName()},
      );
      await _tokens.save(TokenPair.fromJson(res.data!));
    } on DioException catch (e) {
      throw AppException.fromDio(e);
    }
  }

  @override
  Future<Session> me() async => Session.fromJson(await _api.get<Map<String, dynamic>>('/mobile/auth/me'));

  @override
  Future<void> logout() async {
    final tokens = await _tokens.current();
    await _tokens.clear();
    if (tokens == null) return;
    try {
      await _authDio.post<void>('/mobile/auth/logout', data: {'refreshToken': tokens.refreshToken});
    } on DioException {
      // Already signed out locally; the refresh token expires server-side on its own.
    }
  }

  static String _deviceName() {
    final name = 'RinseOps ${Platform.operatingSystem} ${Platform.operatingSystemVersion}';
    return name.length > 100 ? name.substring(0, 100) : name;
  }
}
