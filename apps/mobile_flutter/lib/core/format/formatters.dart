import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../auth/session_controller.dart';
import 'business_time.dart';
import 'money.dart';

/// Currency formatter for the signed-in business.
final moneyFormatProvider = Provider<MoneyFormatter>((ref) => ref.watch(sessionProvider).money);

/// Date/time display helpers. API timestamps are UTC instants; they are shown
/// in the business time zone ([BusinessTime]), not the phone's.
abstract final class Fmt {
  static final _time = DateFormat.jm();
  static final _dayMonth = DateFormat('d MMM');
  static final _dayMonthYear = DateFormat('d MMM y');
  static final _weekdayDayMonth = DateFormat('EEE, d MMM');

  static String time(DateTime t) => _time.format(BusinessTime.local(t));

  static String date(DateTime t) {
    final local = BusinessTime.local(t);
    return local.year == BusinessTime.now().year ? _dayMonth.format(local) : _dayMonthYear.format(local);
  }

  static String dateTime(DateTime t) => '${date(t)}, ${time(t)}';

  /// "Mon, 5 Oct" for [t], or for the business's today when omitted.
  static String weekdayDate([DateTime? t]) => _weekdayDayMonth.format(t == null ? BusinessTime.now() : BusinessTime.local(t));

  /// "Today 6:00 PM", "Tomorrow 10:00 AM", "Yesterday …" or "3 Oct, 6:00 PM",
  /// with today/tomorrow judged on the business calendar.
  static String relativeDue(DateTime t, {DateTime? now}) {
    final local = BusinessTime.local(t);
    final today = _dateOnly(now == null ? BusinessTime.now() : BusinessTime.local(now));
    final diff = _dateOnly(local).difference(today).inDays;
    final label = switch (diff) {
      0 => 'Today',
      1 => 'Tomorrow',
      -1 => 'Yesterday',
      _ => date(local),
    };
    return diff.abs() <= 1 ? '$label ${time(local)}' : '$label, ${time(local)}';
  }

  /// Calendar day as a UTC-midnight value, so day differences ignore DST.
  static DateTime _dateOnly(DateTime t) => DateTime.utc(t.year, t.month, t.day);

  /// Quantity without trailing zeros: "2", "1.5".
  static String quantity(String q) {
    final n = num.tryParse(q);
    if (n == null) return q;
    return n == n.roundToDouble() ? n.toInt().toString() : n.toString();
  }

  static String money(MoneyFormatter f, Money m) => f.format(m);
}
