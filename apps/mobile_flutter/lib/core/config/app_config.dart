/// Build-time configuration, supplied with
/// `--dart-define-from-file=config/<environment>.json`.
///
/// The API base URL is the only place a server address lives in Dart code.
enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig({required this.environment, required this.apiBaseUrl});

  final AppEnvironment environment;

  /// e.g. `http://192.168.1.20:4000/api/v1` (no trailing slash).
  final String apiBaseUrl;

  bool get isDevelopment => environment == AppEnvironment.development;

  static const _env = String.fromEnvironment('APP_ENV', defaultValue: 'development');
  static const _apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Reads and validates the compile-time values. Throws [StateError] on a
  /// misconfigured build so it fails at startup rather than on first request.
  factory AppConfig.fromEnvironment() => AppConfig.parse(env: _env, apiBaseUrl: _apiBaseUrl);

  factory AppConfig.parse({required String env, required String apiBaseUrl}) {
    final environment = AppEnvironment.values.where((e) => e.name == env).firstOrNull;
    if (environment == null) {
      throw StateError('APP_ENV must be one of ${AppEnvironment.values.map((e) => e.name).join(', ')} (got "$env")');
    }
    if (apiBaseUrl.contains('<') || apiBaseUrl.contains('>')) {
      throw StateError('API_BASE_URL is still the template value ($apiBaseUrl). Set the real URL in config/${environment.name}.json');
    }
    final uri = Uri.tryParse(apiBaseUrl);
    if (apiBaseUrl.isEmpty || uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw StateError('API_BASE_URL is missing or invalid. Build with --dart-define-from-file=config/${environment.name}.json');
    }
    if (environment != AppEnvironment.development && uri.scheme != 'https') {
      throw StateError('API_BASE_URL must use https:// for ${environment.name} builds (got $apiBaseUrl)');
    }
    final normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.substring(0, apiBaseUrl.length - 1) : apiBaseUrl;
    return AppConfig(environment: environment, apiBaseUrl: normalized);
  }
}
