import 'package:timezone/data/latest_10y.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// The business's wall clock (TenantSettings.timezone, e.g. "Asia/Kolkata").
///
/// Every displayed time and every calendar-day decision (today, due dates,
/// "today's payments") uses this zone, not the phone's, so a phone set to
/// another zone still shows what the counter and the web app show. Instants
/// are still compared directly (overdue, token expiry), which is zone-free.
abstract final class BusinessTime {
  static bool _initialized = false;
  static tz.Location _location = tz.UTC;

  /// Loads the time zone database once (call at startup; idempotent).
  static void initialize() {
    if (_initialized) return;
    tzdata.initializeTimeZones();
    _initialized = true;
  }

  /// Switches to the signed-in tenant's zone. Unknown names fall back to UTC.
  static void use(String timezone) {
    initialize();
    try {
      _location = tz.getLocation(timezone);
    } on tz.LocationNotFoundException {
      _location = tz.UTC;
    }
  }

  static String get name => _location.name;

  /// Current business-local time.
  static tz.TZDateTime now() => tz.TZDateTime.now(_location);

  /// [instant] (UTC or any zone) expressed in business-local time.
  static tz.TZDateTime local(DateTime instant) => tz.TZDateTime.from(instant, _location);

  /// The instant for a business-local wall-clock time.
  static tz.TZDateTime at(int year, int month, int day, [int hour = 0, int minute = 0]) =>
      tz.TZDateTime(_location, year, month, day, hour, minute);

  /// Business-local calendar fields as a zone-less [DateTime], for Material
  /// date/time pickers, which work in "naive" calendar values.
  static DateTime naive(DateTime instant) {
    final l = local(instant);
    return DateTime(l.year, l.month, l.day, l.hour, l.minute);
  }

  /// Today's business date as YYYY-MM-DD (the API's calendar date format).
  static String todayKey() {
    final n = now();
    return '${n.year.toString().padLeft(4, '0')}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }
}
