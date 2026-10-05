import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/api/api_client.dart';
import 'package:rinseops/core/auth/session_models.dart';
import 'package:rinseops/core/domain/enums.dart';
import 'package:rinseops/core/domain/refs.dart';
import 'package:rinseops/core/errors/app_exception.dart';
import 'package:rinseops/core/format/money.dart';
import 'package:rinseops/features/catalog/data/catalog_models.dart';
import 'package:rinseops/features/customers/data/customer_models.dart';
import 'package:rinseops/features/customers/data/customers_repository.dart';
import 'package:rinseops/features/dashboard/data/dashboard_repository.dart';
import 'package:rinseops/features/driver/data/tasks_repository.dart';
import 'package:rinseops/features/garments/data/garments_repository.dart';
import 'package:rinseops/features/orders/data/order_models.dart';
import 'package:rinseops/features/orders/data/orders_repository.dart';
import 'package:rinseops/features/payments/data/payments_repository.dart';
import 'package:rinseops/features/pos/domain/cart.dart';
import 'package:rinseops/features/racks/data/racks_repository.dart';

import '../helpers/fake_http.dart';

Object _fixture(String name) => jsonDecode(File('test/fixtures/$name.json').readAsStringSync());

/// Serves the recorded API responses by path.
FakeHttp _server({Map<String, FakeResponse> overrides = const {}}) => FakeHttp((req) async {
  if (overrides.containsKey(req.path)) return overrides[req.path]!;
  final fixture = switch (req.path) {
    '/mobile/auth/me' => 'me',
    '/dashboard' => 'dashboard',
    '/orders' => 'orders',
    '/customers' => 'customers',
    '/catalog/pos' => 'pos',
    '/racks' => 'racks',
    '/garments' => 'garments',
    '/tasks/mine' => 'tasks_mine',
    final p when p.startsWith('/orders/') => 'order',
    final p when p.startsWith('/customers/') => 'customer',
    _ => null,
  };
  return fixture == null ? const FakeResponse(200, {}) : FakeResponse(200, _fixture(fixture));
});

void main() {
  group('models parse real API responses', () {
    test('session, dashboard, orders, customers, catalog, racks, garments, driver tasks', () async {
      final api = ApiClient(fakeDio(_server()));
      final me = Session.fromJson(_fixture('me') as Map<String, dynamic>);
      expect(me.stores, isNotEmpty);

      final dash = await DashboardRepository(api).load();
      expect(dash.metrics.revenueToday.isPositive, isTrue);
      expect(dash.recentOrders, isNotEmpty);

      final orders = await ApiOrdersRepository(api).list(const OrderQuery());
      expect(orders.items.first.orderNumber, startsWith('RO-'));

      final order = await ApiOrdersRepository(api).get('x');
      expect(order.balanceDue, order.grandTotal - order.paidAmount);
      expect(order.garments, isNotEmpty);
      expect(order.workflow.allowedTransitions, isNotEmpty);

      final customer = await ApiCustomersRepository(api).get('x');
      expect(customer.stats.totalOrders, greaterThan(0));
      expect(customer.stats.cancelledOrders, 0, reason: 'older servers omit the field');
      final withCancelled = CustomerDetail.fromJson(
        (_fixture('customer') as Map<String, dynamic>)..['stats'] = {
          ...((_fixture('customer') as Map<String, dynamic>)['stats'] as Map<String, dynamic>),
          'cancelledOrders': 1,
        },
      );
      expect(withCancelled.stats.cancelledOrders, 1);

      final catalog = PosCatalog.fromJson(_fixture('pos') as Map<String, dynamic>);
      expect(catalog.categories.expand((c) => c.items), isNotEmpty);

      final board = await RacksRepository(api).board();
      expect(board.racks, isNotEmpty);

      final garments = await GarmentsRepository(api).list();
      expect(garments.items.first.tagCode, startsWith('GAR-'));

      final tasks = await ApiTasksRepository(api).myTasks();
      expect(tasks.map((t) => t.type).toSet(), containsAll([TaskType.pickup, TaskType.delivery]));
    });
  });

  group('OrdersRepository', () {
    test('sends filters as query parameters and skips empty ones', () async {
      final http = _server();
      await ApiOrdersRepository(ApiClient(fakeDio(http)))
          .list(const OrderQuery(quick: OrderQuickFilter.dueToday, status: OrderStatus.qualityCheck, search: '  RO-1 '), page: 2);
      final q = http.requests.single.query;
      expect(q, {'page': 2, 'pageSize': 25, 'quick': 'due_today', 'status': 'QUALITY_CHECK', 'q': 'RO-1'});
    });

    test('status change, rack assignment and release hit the right endpoints', () async {
      final http = _server();
      final repo = ApiOrdersRepository(ApiClient(fakeDio(http)));
      await repo.changeStatus('o1', OrderStatus.delivered, allowOutstanding: true);
      await repo.assignRack('o1', 'slot-9');
      await repo.releaseRack('o1');
      expect(http.requests.map((r) => '${r.method} ${r.path}'), [
        'POST /orders/o1/status',
        'POST /orders/o1/rack',
        'DELETE /orders/o1/rack',
      ]);
      expect(http.requests[0].body, {'status': 'DELIVERED', 'allowOutstanding': true});
      expect(http.requests[1].body, {'rackSlotId': 'slot-9'});
    });

    test('create sends the cart as a POST /orders body with a stable idempotency key', () async {
      final http = _server(overrides: {'/orders': FakeResponse(201, _fixture('order'))});
      final catalog = PosCatalog.fromJson(_fixture('pos') as Map<String, dynamic>);
      final dc = catalog.categories.first;
      final shirt = dc.items.first;
      final due = DateTime.utc(2030, 1, 2, 12);
      var draft = CartDraft(storeId: 'store-1', dueDate: due, priceListId: catalog.priceList.id)
          .withCustomer(const CustomerRef(id: 'cust-1', firstName: 'Asha', phone: '9000000000'))
          .add(dc, shirt)
          .add(dc, shirt)
          .withDiscount(const CartDiscount(DiscountType.percent, '10.00'))
          .withPayment(CartPayment(PaymentMethod.upi, Money.parse('100')));
      draft = draft.toggleModifier(draft.lines.single.key, catalog.modifiers.first.id);

      await ApiOrdersRepository(ApiClient(fakeDio(http))).create(draft);
      final body = http.requests.single.body! as Map<String, dynamic>;
      expect(http.requests.single.path, '/orders');
      expect(body['customerId'], 'cust-1');
      expect(body['storeId'], 'store-1');
      expect(body['dueDate'], '2030-01-02T12:00:00.000Z');
      expect(body['lines'], [
        {
          'serviceCategoryId': dc.id,
          'serviceItemId': shirt.serviceItemId,
          'quantity': '2',
          'modifierIds': [catalog.modifiers.first.id],
        },
      ]);
      expect(body['discount'], {'type': 'PERCENT', 'value': '10.00'});
      expect(body['payments'], [
        {'method': 'UPI', 'amount': '100.00'},
      ]);
      expect(body['idempotencyKey'], draft.idempotencyKey);
      expect(draft.withDueDate(due).idempotencyKey, draft.idempotencyKey);
    });
  });

  group('PaymentsRepository', () {
    test('records a partial payment and returns the new balance', () async {
      final http = _server(
        overrides: {
          '/payments': const FakeResponse(201, {
            'id': 'p1',
            'order': {
              'id': 'o1',
              'orderNumber': 'RO-1',
              'grandTotal': '855.50',
              'paidAmount': '628.00',
              'balanceDue': '227.50',
              'paymentStatus': 'PARTIAL',
            },
          }),
        },
      );
      final result = await PaymentsRepository(ApiClient(fakeDio(http))).record(
        orderId: 'o1',
        amount: Money.parse('200'),
        method: PaymentMethod.bankTransfer,
        reference: ' NEFT123 ',
        idempotencyKey: 'key-12345',
      );
      expect(http.requests.single.body, {
        'orderId': 'o1',
        'amount': '200.00',
        'method': 'BANK_TRANSFER',
        'reference': 'NEFT123',
        'idempotencyKey': 'key-12345',
      });
      expect(result.balanceDue, Money.parse('227.50'));
      expect(result.paymentStatus, OrderPaymentStatus.partial);
    });

    test('surfaces the API error message', () async {
      final http = _server(
        overrides: {
          '/payments': const FakeResponse(422, {
            'statusCode': 422,
            'error': {'code': 'PAYMENT_EXCEEDS_BALANCE', 'message': 'Payment is more than the balance due.'},
          }),
        },
      );
      await expectLater(
        PaymentsRepository(ApiClient(fakeDio(http))).record(orderId: 'o1', amount: Money.parse('9999'), method: PaymentMethod.cash),
        throwsA(
          isA<AppException>()
              .having((e) => e.code, 'code', 'PAYMENT_EXCEEDS_BALANCE')
              .having((e) => e.message, 'message', contains('balance')),
        ),
      );
    });
  });

  test('garment tag lookup returns null for an unknown tag', () async {
    final http = _server(
      overrides: {
        '/garments/tag/GAR-404': const FakeResponse(404, {
          'statusCode': 404,
          'error': {'code': 'GARMENT_NOT_FOUND', 'message': 'No garment found.'},
        }),
      },
    );
    expect(await GarmentsRepository(ApiClient(fakeDio(http))).byTag(' gar-404 '), isNull);
  });

  test('customer create sends trimmed fields and an optional address', () async {
    final http = _server(overrides: {'/customers': FakeResponse(201, _fixture('customer'))});
    await ApiCustomersRepository(ApiClient(fakeDio(http))).create(
      const NewCustomer(firstName: ' Meera ', lastName: '', phone: '98765 43210', email: '', addressLine1: '12 MG Road', city: 'Pune'),
    );
    expect(http.requests.single.body, {
      'firstName': 'Meera',
      'phone': '98765 43210',
      'address': {'label': 'Home', 'addressLine1': '12 MG Road', 'city': 'Pune', 'isDefault': true},
    });
  });

  test('driver status change sends the failure reason', () async {
    final http = _server();
    await ApiTasksRepository(ApiClient(fakeDio(http))).changeStatus('t1', TaskStatus.failed, note: ' Customer not home ');
    expect(http.requests.single.path, '/tasks/t1/status');
    expect(http.requests.single.body, {'status': 'FAILED', 'note': 'Customer not home'});
  });
}
