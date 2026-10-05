import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:rinseops/core/format/money.dart';
import 'package:rinseops/features/orders/data/order_models.dart';
import 'package:rinseops/features/orders/widgets/order_totals.dart';

Map<String, dynamic> _fixture() => jsonDecode(File('test/fixtures/order.json').readAsStringSync()) as Map<String, dynamic>;

Future<void> _pump(WidgetTester tester, OrderDetail order) => tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      body: OrderTotals(
        order: order,
        money: MoneyFormatter(currency: 'INR', locale: 'en-IN'),
      ),
    ),
  ),
);

String _rowValue(WidgetTester tester, String label) {
  final row = find.ancestor(of: find.text(label), matching: find.byType(Row)).first;
  final texts = tester.widgetList<Text>(find.descendant(of: row, matching: find.byType(Text))).map((t) => t.data).toList();
  return texts.last!;
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets('shows subtotal, tax, total, paid and outstanding for a partly paid order', (tester) async {
    final order = OrderDetail.fromJson(_fixture()); // real API response: 725 + 18% GST, 428 paid
    await _pump(tester, order);

    expect(_rowValue(tester, 'Subtotal'), '₹725.00');
    expect(_rowValue(tester, 'GST (18%)'), '₹130.50');
    expect(_rowValue(tester, 'Total'), '₹855.50');
    expect(_rowValue(tester, 'Paid'), '₹428.00');
    expect(_rowValue(tester, 'Outstanding'), '₹427.50');
    expect(find.textContaining('Discount'), findsNothing);
  });

  testWidgets('shows a percentage discount and a settled balance', (tester) async {
    final json = _fixture()
      ..['discountType'] = 'PERCENT'
      ..['discountValue'] = '10.00'
      ..['discountAmount'] = '72.50'
      ..['taxAmount'] = '117.45'
      ..['grandTotal'] = '769.95'
      ..['paidAmount'] = '769.95'
      ..['balanceDue'] = '0.00'
      ..['paymentStatus'] = 'PAID';
    await _pump(tester, OrderDetail.fromJson(json));

    expect(_rowValue(tester, 'Discount (10%)'), '− ₹72.50');
    expect(_rowValue(tester, 'Total'), '₹769.95');
    expect(_rowValue(tester, 'Outstanding'), '₹0.00');
  });
}
