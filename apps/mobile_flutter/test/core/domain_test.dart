import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/config/app_config.dart';
import 'package:rinseops/core/domain/enums.dart';
import 'package:rinseops/core/domain/workflow.dart';
import 'package:rinseops/core/format/money.dart';

void main() {
  group('Money', () {
    test('parses API decimal strings exactly', () {
      expect(Money.parse('120.00').minor, 12000);
      expect(Money.parse('120.5').minor, 12050);
      expect(Money.parse('0.07').minor, 7);
      expect(Money.parse('-3.25').minor, -325);
      expect(Money.parse('855.50') - Money.parse('428.00'), Money.parse('427.50'));
      expect(() => Money.parse('1.234'), throwsFormatException);
      expect(Money.tryParse('abc'), isNull);
    });

    test('round-trips to the API format', () {
      expect(Money.parse('5').toApi(), '5.00');
      expect(const Money(12345).toApi(), '123.45');
      expect(const Money(-5).toApi(), '-0.05');
    });

    test('formats in the business currency', () {
      final inr = MoneyFormatter(currency: 'INR', locale: 'en-IN');
      expect(inr.format(Money.parse('1234.5')), '₹1,234.50');
      expect(inr.format(Money.parse('125000')), '₹1,25,000.00');
    });
  });

  group('Order status mapping', () {
    test('maps every API status', () {
      expect(OrderStatus.fromWire('RECEIVED'), OrderStatus.received);
      expect(OrderStatus.fromWire('QUALITY_CHECK'), OrderStatus.qualityCheck);
      expect(OrderStatus.fromWire('READY'), OrderStatus.ready);
      expect(OrderStatus.fromWire('DELIVERED'), OrderStatus.delivered);
      expect(OrderStatus.fromWire('CANCELLED'), OrderStatus.cancelled);
      for (final s in OrderStatus.values.where((s) => s != OrderStatus.unknown)) {
        expect(OrderStatus.fromWire(s.wire), s, reason: s.wire);
      }
    });

    test('unknown values from a newer server do not crash', () {
      expect(OrderStatus.fromWire('ON_HOLD'), OrderStatus.unknown);
      expect(TaskStatus.fromWire('X'), TaskStatus.unknown);
      expect(PaymentMethod.fromWire('CRYPTO'), PaymentMethod.other);
    });

    test('labels, stages and terminal states', () {
      expect(OrderStatus.qualityCheck.label, 'Quality check');
      expect(OrderStatus.stages.map((s) => s.stageIndex), [0, 1, 2, 3, 4]);
      expect(OrderStatus.delivered.isTerminal, isTrue);
      expect(OrderStatus.cancelled.isTerminal, isTrue);
      expect(OrderStatus.ready.isTerminal, isFalse);
      expect(PaymentMethod.bankTransfer.wire, 'BANK_TRANSFER');
      expect(OrderPaymentStatus.fromWire('PARTIAL').label, 'Partly paid');
    });
  });

  group('Driver task actions', () {
    test('follow the server task workflow', () {
      expect(driverActionsFor(TaskType.pickup, TaskStatus.assigned), [DriverAction.start]);
      expect(driverActionsFor(TaskType.pickup, TaskStatus.outForPickup), [DriverAction.pickedUp, DriverAction.failed]);
      expect(driverActionsFor(TaskType.delivery, TaskStatus.outForDelivery), [DriverAction.delivered, DriverAction.failed]);
      expect(driverActionsFor(TaskType.delivery, TaskStatus.delivered), isEmpty);
      expect(driverActionsFor(TaskType.pickup, TaskStatus.failed), isEmpty);
      expect(targetStatus(TaskType.pickup, DriverAction.start), TaskStatus.outForPickup);
      expect(targetStatus(TaskType.delivery, DriverAction.start), TaskStatus.outForDelivery);
      expect(targetStatus(TaskType.delivery, DriverAction.failed).wire, 'FAILED');
    });
  });

  group('AppConfig', () {
    test('development may use http on the LAN', () {
      final c = AppConfig.parse(env: 'development', apiBaseUrl: 'http://192.168.1.20:4000/api/v1/');
      expect(c.apiBaseUrl, 'http://192.168.1.20:4000/api/v1');
      expect(c.isDevelopment, isTrue);
    });

    test('staging and production require https', () {
      expect(() => AppConfig.parse(env: 'production', apiBaseUrl: 'http://api.example.com/api/v1'), throwsStateError);
      expect(() => AppConfig.parse(env: 'staging', apiBaseUrl: 'http://10.0.0.1/api/v1'), throwsStateError);
      expect(AppConfig.parse(env: 'production', apiBaseUrl: 'https://api.example.com/api/v1').environment, AppEnvironment.production);
    });

    test('rejects an unfilled template URL', () {
      expect(() => AppConfig.parse(env: 'production', apiBaseUrl: 'https://<production-api-host>/api/v1'), throwsStateError);
    });

    test('rejects a missing URL or unknown environment', () {
      expect(() => AppConfig.parse(env: 'development', apiBaseUrl: ''), throwsStateError);
      expect(() => AppConfig.parse(env: 'qa', apiBaseUrl: 'https://x.test'), throwsStateError);
    });
  });
}
