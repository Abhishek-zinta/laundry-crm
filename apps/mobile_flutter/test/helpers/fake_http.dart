import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A recorded request seen by [FakeHttp].
class Seen {
  Seen(this.method, this.path, this.query, this.headers, this.body);
  final String method;
  final String path;
  final Map<String, dynamic> query;
  final Map<String, dynamic> headers;
  final Object? body;

  String? get bearer => (headers['Authorization'] as String?)?.replaceFirst('Bearer ', '');
}

class FakeResponse {
  const FakeResponse(this.status, [this.body, this.delay = Duration.zero]);
  final int status;
  final Object? body;
  final Duration delay;
}

/// In-memory HTTP server for Dio. [handler] maps a request to a response;
/// throwing a [DioException] from it simulates a transport failure.
class FakeHttp implements HttpClientAdapter {
  FakeHttp(this.handler);
  final Future<FakeResponse> Function(Seen req) handler;
  final requests = <Seen>[];

  int count(String path) => requests.where((r) => r.path == path).length;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    Object? body;
    if (requestStream != null) {
      final bytes = await requestStream.fold<List<int>>([], (a, b) => a..addAll(b));
      if (bytes.isNotEmpty) body = jsonDecode(utf8.decode(bytes));
    }
    final seen = Seen(options.method, options.path, options.queryParameters, Map.of(options.headers), body);
    requests.add(seen);
    final res = await handler(seen);
    if (res.delay > Duration.zero) await Future<void>.delayed(res.delay);
    return ResponseBody.fromString(
      res.body == null ? '' : jsonEncode(res.body),
      res.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio fakeDio(FakeHttp http) =>
    Dio(BaseOptions(baseUrl: 'http://api.test/api/v1', contentType: Headers.jsonContentType))..httpClientAdapter = http;

Map<String, dynamic> tokenJson(String access, String refresh, {Duration accessTtl = const Duration(minutes: 15)}) => {
  'tokenType': 'Bearer',
  'accessToken': access,
  'accessTokenExpiresAt': DateTime.now().add(accessTtl).toUtc().toIso8601String(),
  'expiresIn': accessTtl.inSeconds,
  'refreshToken': refresh,
  'refreshTokenExpiresAt': DateTime.now().add(const Duration(days: 30)).toUtc().toIso8601String(),
};

const unauthorized = FakeResponse(401, {
  'statusCode': 401,
  'error': {'code': 'UNAUTHORIZED', 'message': 'Your session has expired. Please sign in again.'},
});
