import 'package:intl/intl.dart';
import 'package:json_annotation/json_annotation.dart';

/// Exact money amount held in minor units (paise/cents).
///
/// The API sends money as decimal strings ("120.50"); parsing them into
/// doubles would lose precision, so amounts stay integral end to end.
class Money implements Comparable<Money> {
  const Money(this.minor);

  final int minor;

  static const zero = Money(0);

  /// Parses "120", "120.5", "120.50", "-3.25". Throws [FormatException] otherwise.
  factory Money.parse(String value) {
    final match = RegExp(r'^(-)?(\d+)(?:\.(\d{1,2}))?$').firstMatch(value.trim());
    if (match == null) throw FormatException('Invalid money amount', value);
    final whole = int.parse(match.group(2)!);
    final fraction = int.parse((match.group(3) ?? '').padRight(2, '0'));
    final minor = whole * 100 + fraction;
    return Money(match.group(1) == null ? minor : -minor);
  }

  /// Lenient parse for user input; null when the text is not a valid amount.
  static Money? tryParse(String value) {
    try {
      return Money.parse(value);
    } on FormatException {
      return null;
    }
  }

  bool get isZero => minor == 0;
  bool get isPositive => minor > 0;
  bool get isNegative => minor < 0;

  Money operator +(Money other) => Money(minor + other.minor);
  Money operator -(Money other) => Money(minor - other.minor);
  bool operator >(Money other) => minor > other.minor;
  bool operator <(Money other) => minor < other.minor;
  bool operator >=(Money other) => minor >= other.minor;
  bool operator <=(Money other) => minor <= other.minor;

  /// Wire format expected by the API: "120.50".
  String toApi() {
    final sign = minor < 0 ? '-' : '';
    final abs = minor.abs();
    return '$sign${abs ~/ 100}.${(abs % 100).toString().padLeft(2, '0')}';
  }

  @override
  int compareTo(Money other) => minor.compareTo(other.minor);

  @override
  bool operator ==(Object other) => other is Money && other.minor == minor;

  @override
  int get hashCode => minor.hashCode;

  @override
  String toString() => toApi();
}

/// Formats [Money] for display in the business currency and locale.
class MoneyFormatter {
  MoneyFormatter({required String currency, required String locale})
    : _format = NumberFormat.simpleCurrency(locale: locale, name: currency, decimalDigits: 2);

  final NumberFormat _format;

  String format(Money amount) => _format.format(amount.minor / 100);
}

class MoneyConverter implements JsonConverter<Money, String> {
  const MoneyConverter();

  @override
  Money fromJson(String json) => Money.parse(json);

  @override
  String toJson(Money object) => object.toApi();
}
