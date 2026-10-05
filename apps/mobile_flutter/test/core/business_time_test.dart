import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:rinseops/core/format/business_time.dart';
import 'package:rinseops/core/format/formatters.dart';
import 'package:rinseops/features/pos/domain/cart.dart';

/// intl's CLDR data puts a narrow no-break space (U+202F) before AM/PM.
String plain(String s) => s.replaceAll('\u202f', ' ');

void main() {
  setUpAll(() async {
    await initializeDateFormatting();
    BusinessTime.initialize();
  });
  tearDown(() => BusinessTime.use('UTC'));

  // 2026-10-05T02:30Z is 8:00 AM on 5 Oct in Kolkata but 10:30 PM on 4 Oct in
  // New York: the same instant falls on different business days.
  final instant = DateTime.utc(2026, 10, 5, 2, 30);

  test('formats API instants on the business clock, whatever the phone zone', () {
    BusinessTime.use('Asia/Kolkata');
    expect(plain(Fmt.time(instant)), '8:00 AM');
    expect(Fmt.date(instant), startsWith('5 Oct'));

    BusinessTime.use('America/New_York');
    expect(plain(Fmt.time(instant)), '10:30 PM');
    expect(Fmt.date(instant), startsWith('4 Oct'));
  });

  test('today / tomorrow follow the business calendar', () {
    BusinessTime.use('Asia/Kolkata');
    final now = DateTime.utc(2026, 10, 4, 20); // 5 Oct, 1:30 AM in Kolkata
    expect(plain(Fmt.relativeDue(DateTime.utc(2026, 10, 5, 12, 30), now: now)), 'Today 6:00 PM');
    expect(plain(Fmt.relativeDue(DateTime.utc(2026, 10, 6, 12, 30), now: now)), 'Tomorrow 6:00 PM');
    expect(plain(Fmt.relativeDue(DateTime.utc(2026, 10, 4, 12, 30), now: now)), 'Yesterday 6:00 PM');
  });

  test('wall-clock times entered in the app become the right instant', () {
    BusinessTime.use('Asia/Kolkata');
    expect(BusinessTime.at(2026, 10, 7, 18).toUtc(), DateTime.utc(2026, 10, 7, 12, 30));
    final naive = BusinessTime.naive(DateTime.utc(2026, 10, 7, 12, 30));
    expect([naive.year, naive.month, naive.day, naive.hour, naive.minute], [2026, 10, 7, 18, 0]);
  });

  test('default due date rounds up to the hour on the business clock', () {
    BusinessTime.use('Asia/Kolkata');
    final dropOff = BusinessTime.at(2026, 10, 5, 14, 30); // 2:30 PM
    expect(defaultDueDate(48, now: dropOff), BusinessTime.at(2026, 10, 7, 15));
    expect(defaultDueDate(24, now: BusinessTime.at(2026, 10, 5, 9)), BusinessTime.at(2026, 10, 6, 9));
  });

  test("today's key for date-filtered API calls uses the business date", () {
    BusinessTime.use('Pacific/Kiritimati'); // UTC+14: usually a day ahead of UTC
    final n = BusinessTime.now();
    expect(BusinessTime.todayKey(), '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}');
  });

  test('unknown zone names fall back to UTC instead of crashing', () {
    BusinessTime.use('Mars/Olympus_Mons');
    expect(BusinessTime.name, endsWith('UTC'));
  });
}
