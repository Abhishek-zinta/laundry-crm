# RinseOps mobile (Flutter)

Native Android + iOS client for RinseOps. It is a separate Flutter app (not part
of the npm workspace) that talks to the existing NestJS API in `apps/api`. No
WebView, no embedded web pages.

- Flutter stable 3.47 / Dart 3.13, Material 3
- Riverpod (state), go_router (navigation), Dio (HTTP), flutter_secure_storage (tokens),
  json_serializable (models), connectivity_plus, intl, url_launcher (dialer/maps)

## Run against the local API

```bash
# 1. API + database (repo root)
docker compose up -d && npm run db:deploy && npm run db:seed && npm run dev

# 2. Point the app at this machine's LAN IP (writes config/development.json)
cd apps/mobile_flutter
tool/dev_config.sh            # -> http://192.168.x.x:4000/api/v1

# 3. Run on an emulator/device
flutter run --dart-define-from-file=config/development.json

# Debug APK
flutter build apk --debug --dart-define-from-file=config/development.json
```

Demo logins (seed data): `owner@freshfold.test`, `counter@freshfold.test`,
`driver@freshfold.test`, … password `Password123!`.

## Environments

The API base URL comes only from build configuration (`--dart-define-from-file`).
Real config files are git-ignored; only `*.example.json` templates are tracked.

| Environment | Config file | How it is created | URL rule |
| --- | --- | --- | --- |
| development | `config/development.json` | `tool/dev_config.sh` (detects this machine's LAN IP) | `http://` allowed |
| staging | `config/staging.json` | copy `config/staging.example.json`, set the real URL | must be `https://` |
| production | `config/production.json` | copy `config/production.example.json`, set the real URL | must be `https://` |

```bash
tool/check_config.sh staging          # fails on a missing file, template URL or non-HTTPS URL
flutter build apk --release --dart-define-from-file=config/staging.json
# CI alternative without a file:
flutter build apk --release --dart-define=APP_ENV=production --dart-define=API_BASE_URL=https://…/api/v1
```

`AppConfig` repeats these checks at startup. Android allows cleartext only in the
**debug** manifest; iOS only relaxes ATS for local-network hosts (`NSAllowsLocalNetworking`).

## Time zone

All displayed times and calendar-day decisions (today, due dates, "today's payments")
use the business time zone from `TenantSettings.timezone` (`BusinessTime`), not the
phone's, so the app matches the web app and the counter regardless of device settings.

## Branding

Launcher icons and the native splash are generated from `assets/branding/`
(rendered from the web favicon's wave mark by `tool/render_brand.py`):

```bash
python3 tool/render_brand.py
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

## Authentication

Uses the API's native-app token flow (the web keeps its cookie + CSRF login):

- `POST /mobile/auth/login` → short-lived JWT access token (15 min) + opaque refresh token (30 days)
- `POST /mobile/auth/refresh` rotates the refresh token; reuse of an old one revokes the session family
- `POST /mobile/auth/logout` revokes server-side; `GET /mobile/auth/me` returns the session

Tokens live in the Android Keystore / iOS Keychain (`flutter_secure_storage`).
`AuthInterceptor` attaches the bearer token, refreshes proactively shortly before
expiry, and on a 401 performs **one** single-flight refresh and retries the request
**once**. A rejected refresh clears credentials and returns to the login screen; a
network failure during refresh keeps them.

## Structure

```
lib/
  app/            app.dart, router.dart (role/permission redirects), shell.dart (NavigationBar / NavigationRail), theme.dart
  core/
    api/          ApiClient, AuthInterceptor
    auth/         TokenManager, SessionController, session models, store context
    config/       AppConfig (environment + URL validation)
    domain/       API enums, refs, workflow rules, @apiModel converters
    errors/       AppException (API error envelope → UI message)
    format/       Money (exact minor units), date/currency formatting
    network/      connectivity banner
    storage/      TokenStorage (secure / in-memory)
    widgets/      shared UI (async states, pills, paging, dialogs, store switcher)
  features/       auth, dashboard, customers, catalog, orders, pos, garments, payments, racks, driver, settings
```

Screens never call Dio directly; they go through repositories. Catalog, customers,
orders and driver tasks are behind interfaces (`CatalogRepository`, …) so a
local Drift/SQLite cache can later wrap them as decorators.

## Extension points (not implemented yet)

| Capability | Where it plugs in |
| --- | --- |
| QR / barcode tag scanning (`mobile_scanner`) | implement `TagScanner` and override `tagScannerProvider` |
| Camera garment photos (`camera`) | garment detail sheet + a new upload endpoint |
| Push notifications (`firebase_messaging`) | app start-up + a device-token endpoint |
| Bluetooth/USB receipt printing | an order-detail action |
| Driver GPS (`geolocator`) | `TasksRepository` + driver screen |
| Offline orders / background sync (`drift`, `workmanager`) | cache decorators over the repository interfaces; `CartDraft` already carries an idempotency key |
| Biometric unlock | gate in `SessionController.restore()` before using stored tokens |

## Tests

```bash
dart run build_runner build   # regenerate *.g.dart after model changes
flutter analyze
flutter test
```

Fixtures in `test/fixtures` are real responses recorded from the local API, so
model parsing is checked against the actual payloads.

## iOS

The iOS project is configured (`com.rinseops.app`), but iOS builds need macOS with
Xcode, CocoaPods, an Apple Developer team for signing (set in Xcode → Runner →
Signing & Capabilities), and `pod install` (run automatically by `flutter build ios`).
