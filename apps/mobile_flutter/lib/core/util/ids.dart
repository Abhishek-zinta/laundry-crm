import 'dart:math';

final _random = Random.secure();

/// Random RFC 4122 v4 UUID, used for idempotency keys.
String randomUuid() {
  final b = List<int>.generate(16, (_) => _random.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

/// Client key so a retried submit never creates a duplicate order/payment.
String newIdempotencyKey(String prefix) => '$prefix-${randomUuid()}';
