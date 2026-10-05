import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../auth/token_pair.dart';

/// Persists the session credentials. Tokens never go to SharedPreferences
/// or logs; the production implementation uses the Android Keystore /
/// iOS Keychain via flutter_secure_storage.
abstract interface class TokenStorage {
  Future<TokenPair?> read();
  Future<void> write(TokenPair tokens);
  Future<void> clear();
}

class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage(iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device));

  static const _key = 'rinseops.session.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<TokenPair?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      return TokenPair.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      // Corrupt or from an incompatible version: start a fresh sign-in.
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(TokenPair tokens) => _storage.write(key: _key, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

/// Volatile storage for tests.
class MemoryTokenStorage implements TokenStorage {
  MemoryTokenStorage([this._tokens]);
  TokenPair? _tokens;

  @override
  Future<TokenPair?> read() async => _tokens;

  @override
  Future<void> write(TokenPair tokens) async => _tokens = tokens;

  @override
  Future<void> clear() async => _tokens = null;
}
