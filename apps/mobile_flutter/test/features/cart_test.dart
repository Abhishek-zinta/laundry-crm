import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rinseops/core/domain/enums.dart';
import 'package:rinseops/core/domain/refs.dart';
import 'package:rinseops/core/format/money.dart';
import 'package:rinseops/features/catalog/data/catalog_models.dart';
import 'package:rinseops/features/pos/domain/cart.dart';

void main() {
  final catalog = PosCatalog.fromJson(jsonDecode(File('test/fixtures/pos.json').readAsStringSync()) as Map<String, dynamic>);
  final dc = catalog.categories.first;
  final shirt = dc.items.first; // ₹120.00 per piece
  final wf = catalog.categories.firstWhere((c) => c.items.any((i) => i.unitType == UnitType.kg));
  final kgItem = wf.items.firstWhere((i) => i.unitType == UnitType.kg);

  CartDraft empty() => CartDraft(storeId: 's', dueDate: DateTime.now().add(const Duration(days: 2)));

  test('quantities stay exact for weighed items', () {
    expect(Qty.tryParse('1.5'), const Qty(1500));
    expect(Qty.tryParse('2'), const Qty(2000));
    expect(Qty.tryParse('0'), isNull);
    expect(Qty.tryParse('1.2345'), isNull);
    expect(const Qty(2500).toApi(), '2.5');
    expect(const Qty(1250).toApi(), '1.25');
  });

  test('adding the same item merges lines; decrement removes at zero', () {
    var d = empty().add(dc, shirt).add(dc, shirt).add(dc, shirt);
    expect(d.lines, hasLength(1));
    expect(d.quantityOf(dc.id, shirt.serviceItemId), const Qty(3000));
    expect(d.baseSubtotal, Money.parse('360.00'));
    d = d.decrement(dc.id, shirt.serviceItemId).decrement(dc.id, shirt.serviceItemId).decrement(dc.id, shirt.serviceItemId);
    expect(d.lines, isEmpty);
  });

  test('kg items step by half a kilo', () {
    final d = empty().add(wf, kgItem).add(wf, kgItem);
    expect(d.lines.single.quantity, const Qty(1500));
    expect(d.baseSubtotal, Money((kgItem.price.minor * 1.5).round()));
  });

  test('blocks submit until customer, items and a future due date are set', () {
    final now = DateTime(2030, 1, 1, 10);
    var d = CartDraft(storeId: 's', dueDate: DateTime(2029, 12, 31));
    expect(d.blockers(now: now), ['Choose a customer', 'Add at least one item', 'Choose a due date in the future']);
    d = d.withCustomer(const CustomerRef(id: 'c', firstName: 'A', phone: '1')).add(dc, shirt).withDueDate(DateTime(2030, 1, 3));
    expect(d.blockers(now: now), isEmpty);
  });

  test('payment is omitted when not collected now', () {
    final d = empty().withCustomer(const CustomerRef(id: 'c', firstName: 'A', phone: '1')).add(dc, shirt);
    expect(d.toCreateOrderJson()['payments'], isEmpty);
    expect(d.withPayment(CartPayment(PaymentMethod.cash, Money.zero)).toCreateOrderJson()['payments'], isEmpty);
  });
}
