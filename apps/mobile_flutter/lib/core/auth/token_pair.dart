/// Credentials issued by POST /mobile/auth/login and /mobile/auth/refresh.
class TokenPair {
  const TokenPair({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
    required this.refreshTokenExpiresAt,
  });

  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String refreshToken;
  final DateTime refreshTokenExpiresAt;

  /// True when the access token is expired or about to expire, so it is
  /// refreshed before use instead of costing a round trip that ends in 401.
  bool accessExpiresWithin(Duration margin, {DateTime? now}) => !(now ?? DateTime.now()).add(margin).isBefore(accessTokenExpiresAt);

  factory TokenPair.fromJson(Map<String, dynamic> json) => TokenPair(
    accessToken: json['accessToken'] as String,
    accessTokenExpiresAt: DateTime.parse(json['accessTokenExpiresAt'] as String),
    refreshToken: json['refreshToken'] as String,
    refreshTokenExpiresAt: DateTime.parse(json['refreshTokenExpiresAt'] as String),
  );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'refreshToken': refreshToken,
    'refreshTokenExpiresAt': refreshTokenExpiresAt.toUtc().toIso8601String(),
  };
}
