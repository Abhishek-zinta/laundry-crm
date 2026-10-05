import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/api/api_client.dart';
import 'package:rinseops/core/api/auth_interceptor.dart';
import 'package:rinseops/core/auth/token_manager.dart';
import 'package:rinseops/core/auth/token_pair.dart';
import 'package:rinseops/core/errors/app_exception.dart';
import 'package:rinseops/core/storage/token_storage.dart';

import '../helpers/fake_http.dart';

/// Server double: accepts only the current access token and rotates the
/// refresh token, rejecting reuse just like the real API.
class _Server {
  String access = 'a1';
  String refresh = 'r1';
  int rotations = 0;
  bool rejectRefresh = false;
  bool refreshNetworkDown = false;
  bool alwaysUnauthorized = false;

  Future<FakeResponse> handle(Seen req) async {
    if (req.path == '/mobile/auth/refresh') {
      if (refreshNetworkDown) {
        throw DioException(
          requestOptions: RequestOptions(path: req.path),
          type: DioExceptionType.connectionError,
        );
      }
      final presented = (req.body as Map)['refreshToken'];
      if (rejectRefresh || presented != refresh) return unauthorized;
      rotations++;
      access = 'a${rotations + 1}';
      refresh = 'r${rotations + 1}';
      return FakeResponse(200, tokenJson(access, refresh), const Duration(milliseconds: 20));
    }
    if (alwaysUnauthorized || req.bearer != access) return unauthorized;
    return const FakeResponse(200, {'ok': true});
  }
}

void main() {
  late _Server server;
  late FakeHttp http;
  late MemoryTokenStorage storage;
  late TokenManager tokens;
  late ApiClient api;

  TokenPair pair(String access, String refresh, {Duration ttl = const Duration(minutes: 10)}) =>
      TokenPair.fromJson(tokenJson(access, refresh, accessTtl: ttl));

  void setUpClient(TokenPair? initial) {
    http = FakeHttp(server.handle);
    storage = MemoryTokenStorage(initial);
    tokens = TokenManager(storage: storage, authDio: fakeDio(http));
    final dio = fakeDio(http);
    dio.interceptors.add(AuthInterceptor(tokens: tokens, dio: dio));
    api = ApiClient(dio);
  }

  setUp(() => server = _Server());

  test('attaches the access token', () async {
    setUpClient(pair('a1', 'r1'));
    await api.get<Map<String, dynamic>>('/dashboard');
    expect(http.requests.single.bearer, 'a1');
  });

  test('on 401 refreshes once, stores the rotated pair and retries the request', () async {
    server.access = 'a-server-only'; // the stored a1 is no longer accepted
    setUpClient(pair('a1', 'r1'));
    // After the refresh the server issues a2; make it the accepted token.
    final res = await api.get<Map<String, dynamic>>('/orders');
    expect(res['ok'], true);
    expect(http.count('/mobile/auth/refresh'), 1);
    expect(http.requests.where((r) => r.path == '/orders').map((r) => r.bearer), ['a1', 'a2']);
    final stored = await storage.read();
    expect(stored!.accessToken, 'a2');
    expect(stored.refreshToken, 'r2');
  });

  test('concurrent 401s share a single refresh (no refresh-token reuse)', () async {
    server.access = 'stale';
    setUpClient(pair('a1', 'r1'));
    final results = await Future.wait([
      api.get<Map<String, dynamic>>('/orders'),
      api.get<Map<String, dynamic>>('/customers'),
      api.get<Map<String, dynamic>>('/dashboard'),
    ]);
    expect(results.every((r) => r['ok'] == true), isTrue);
    expect(http.count('/mobile/auth/refresh'), 1);
    expect(server.rotations, 1);
  });

  test('rejected refresh clears credentials, signals expiry and does not loop', () async {
    server
      ..access = 'stale'
      ..rejectRefresh = true;
    setUpClient(pair('a1', 'r1'));
    var expired = 0;
    tokens.sessionExpired.listen((_) => expired++);

    await expectLater(api.get<Map<String, dynamic>>('/orders'), throwsA(isA<AppException>().having((e) => e.statusCode, 'status', 401)));
    await Future<void>.delayed(Duration.zero);
    expect(expired, 1);
    expect(await storage.read(), isNull);
    expect(http.count('/mobile/auth/refresh'), 1);
    expect(http.count('/orders'), 1);
  });

  test('a retried request that is still 401 is returned, never refreshed again', () async {
    server.alwaysUnauthorized = true;
    setUpClient(pair('a1', 'r1'));
    await expectLater(api.get<Map<String, dynamic>>('/orders'), throwsA(isA<AppException>()));
    expect(http.count('/mobile/auth/refresh'), 1);
    expect(http.count('/orders'), 2); // original + exactly one retry
  });

  test('refreshes proactively when the access token is about to expire', () async {
    setUpClient(pair('a1', 'r1', ttl: const Duration(seconds: 5)));
    server.access = 'a2';
    await api.get<Map<String, dynamic>>('/orders');
    expect(http.requests.map((r) => r.path), ['/mobile/auth/refresh', '/orders']);
    expect(http.requests.last.bearer, 'a2');
  });

  test('network failure during refresh keeps the stored credentials', () async {
    server
      ..access = 'stale'
      ..refreshNetworkDown = true;
    setUpClient(pair('a1', 'r1'));
    await expectLater(api.get<Map<String, dynamic>>('/orders'), throwsA(isA<AppException>().having((e) => e.isNetwork, 'network', true)));
    expect((await storage.read())?.refreshToken, 'r1');
  });

  test('requests flagged skipAuth carry no token and are never refreshed', () async {
    setUpClient(pair('a1', 'r1'));
    final dio = fakeDio(http)..interceptors.add(AuthInterceptor(tokens: tokens, dio: fakeDio(http)));
    await expectLater(
      dio.post<void>('/mobile/auth/login', options: Options(extra: {AuthFlags.skipAuth: true})),
      throwsA(isA<DioException>()),
    );
    expect(http.requests.single.bearer, isNull);
    expect(http.count('/mobile/auth/refresh'), 0);
  });
}
