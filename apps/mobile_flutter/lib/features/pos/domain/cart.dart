import '../../../core/domain/enums.dart';
import '../../../core/domain/refs.dart';
import '../../../core/format/business_time.dart';
import '../../../core/format/money.dart';
import '../../../core/util/ids.dart';
import '../../catalog/data/catalog_models.dart';

/// Quantity in thousandths (1 kg = 1000), so fractional weights stay exact.
class Qty {
  const Qty(this.milli);
  final int milli;

  static const one = Qty(1000);

  /// Parses "2", "1.5", "0.250". Returns null for invalid or non-positive input.
  static Qty? tryParse(String text) {
    final m = RegExp(r'^(\d{1,6})(?:\.(\d{1,3}))?$').firstMatch(text.trim());
    if (m == null) return null;
    final milli = int.parse(m.group(1)!) * 1000 + int.parse((m.group(2) ?? '').padRight(3, '0'));
    return milli > 0 ? Qty(milli) : null;
  }

  String toApi() {
    final whole = milli ~/ 1000;
    final frac = milli % 1000;
    if (frac == 0) return '$whole';
    return '$whole.${frac.toString().padLeft(3, '0').replaceFirst(RegExp(r'0+$'), '')}';
  }

  @override
  bool operator ==(Object other) => other is Qty && other.milli == milli;

  @override
  int get hashCode => milli.hashCode;

  @override
  String toString() => toApi();
}

class CartLine {
  const CartLine({
    required this.key,
    required this.categoryId,
    required this.categoryName,
    required this.item,
    required this.quantity,
    this.modifierIds = const {},
  });

  final String key;
  final String categoryId;
  final String categoryName;
  final PosItem item;
  final Qty quantity;
  final Set<String> modifierIds;

  /// Step for +/- buttons: whole units, or half a kilo for weighed items.
  int get stepMilli => item.unitType.allowsFraction ? 500 : 1000;

  /// Base amount before modifiers (display estimate; the server prices the order).
  Money get baseAmount => Money((item.price.minor * quantity.milli / 1000).round());

  CartLine copyWith({Qty? quantity, Set<String>? modifierIds}) => CartLine(
    key: key,
    categoryId: categoryId,
    categoryName: categoryName,
    item: item,
    quantity: quantity ?? this.quantity,
    modifierIds: modifierIds ?? this.modifierIds,
  );

  Map<String, dynamic> toJson() => {
    'serviceCategoryId': categoryId,
    'serviceItemId': item.serviceItemId,
    'quantity': quantity.toApi(),
    'modifierIds': modifierIds.toList(),
  };
}

class CartDiscount {
  const CartDiscount(this.type, this.value);
  final DiscountType type;

  /// Percentage ("10") or fixed amount ("50.00").
  final String value;

  Map<String, dynamic> toJson() => {'type': type.wire, 'value': value};
}

class CartPayment {
  const CartPayment(this.method, this.amount, {this.reference});
  final PaymentMethod method;
  final Money amount;
  final String? reference;
}

/// Everything needed to create an order. Immutable; the POS controller
/// replaces it on every change.
class CartDraft {
  CartDraft({
    this.customer,
    required this.storeId,
    this.priceListId,
    this.lines = const [],
    this.discount,
    required this.dueDate,
    this.payment,
    this.notes,
    String? idempotencyKey,
  }) : idempotencyKey = idempotencyKey ?? newIdempotencyKey('app');

  final CustomerRef? customer;
  final String storeId;
  final String? priceListId;
  final List<CartLine> lines;
  final CartDiscount? discount;
  final DateTime dueDate;
  final CartPayment? payment;
  final String? notes;

  /// Fixed for the lifetime of a draft so a retried submit can't create two orders.
  final String idempotencyKey;

  int get itemCount => lines.length;

  int get pieceCount =>
      lines.fold(0, (sum, l) => sum + (l.item.unitType.allowsFraction ? 1 : (l.quantity.milli ~/ 1000) * l.item.piecesPerUnit));

  Money get baseSubtotal => lines.fold(Money.zero, (sum, l) => sum + l.baseAmount);

  Qty quantityOf(String categoryId, String serviceItemId) => lines
      .where((l) => l.categoryId == categoryId && l.item.serviceItemId == serviceItemId)
      .fold(const Qty(0), (q, l) => Qty(q.milli + l.quantity.milli));

  /// Reasons the order can't be submitted yet; empty when ready.
  List<String> blockers({DateTime? now}) => [
    if (customer == null) 'Choose a customer',
    if (lines.isEmpty) 'Add at least one item',
    if (!dueDate.isAfter((now ?? DateTime.now()).subtract(const Duration(hours: 1)))) 'Choose a due date in the future',
  ];

  CartDraft _copy({
    CustomerRef? Function()? customer,
    String? Function()? priceListId,
    List<CartLine>? lines,
    CartDiscount? Function()? discount,
    DateTime? dueDate,
    CartPayment? Function()? payment,
    String? Function()? notes,
  }) => CartDraft(
    customer: customer != null ? customer() : this.customer,
    storeId: storeId,
    priceListId: priceListId != null ? priceListId() : this.priceListId,
    lines: lines ?? this.lines,
    discount: discount != null ? discount() : this.discount,
    dueDate: dueDate ?? this.dueDate,
    payment: payment != null ? payment() : this.payment,
    notes: notes != null ? notes() : this.notes,
    idempotencyKey: idempotencyKey,
  );

  CartDraft withCustomer(CustomerRef? c) => _copy(customer: () => c);
  CartDraft withPriceList(String? id) => _copy(priceListId: () => id);
  CartDraft withDiscount(CartDiscount? d) => _copy(discount: () => d);
  CartDraft withDueDate(DateTime d) => _copy(dueDate: d);
  CartDraft withPayment(CartPayment? p) => _copy(payment: () => p);
  CartDraft withNotes(String? n) => _copy(notes: () => n);

  /// Adds one step of [item]; merges into an existing unmodified line of the same item.
  CartDraft add(PosCategory category, PosItem item) {
    final i = lines.indexWhere((l) => l.categoryId == category.id && l.item.serviceItemId == item.serviceItemId && l.modifierIds.isEmpty);
    if (i >= 0) {
      final l = lines[i];
      return _copy(lines: [...lines]..[i] = l.copyWith(quantity: Qty(l.quantity.milli + l.stepMilli)));
    }
    final line = CartLine(
      key: randomUuid(),
      categoryId: category.id,
      categoryName: category.name,
      item: item,
      quantity: item.unitType.allowsFraction ? const Qty(1000) : Qty.one,
    );
    return _copy(lines: [...lines, line]);
  }

  /// Removes one step from the most recent line of [item]; drops the line at zero.
  CartDraft decrement(String categoryId, String serviceItemId) {
    final i = lines.lastIndexWhere((l) => l.categoryId == categoryId && l.item.serviceItemId == serviceItemId);
    if (i < 0) return this;
    return stepLine(lines[i].key, -1);
  }

  CartDraft stepLine(String key, int direction) {
    final i = lines.indexWhere((l) => l.key == key);
    if (i < 0) return this;
    final l = lines[i];
    final next = l.quantity.milli + direction * l.stepMilli;
    if (next <= 0) return removeLine(key);
    return _copy(lines: [...lines]..[i] = l.copyWith(quantity: Qty(next)));
  }

  CartDraft setQuantity(String key, Qty quantity) =>
      _copy(lines: [for (final l in lines) l.key == key ? l.copyWith(quantity: quantity) : l]);

  CartDraft toggleModifier(String key, String modifierId) => _copy(
    lines: [
      for (final l in lines)
        l.key == key
            ? l.copyWith(
                modifierIds: l.modifierIds.contains(modifierId) ? ({...l.modifierIds}..remove(modifierId)) : {...l.modifierIds, modifierId},
              )
            : l,
    ],
  );

  CartDraft removeLine(String key) => _copy(lines: lines.where((l) => l.key != key).toList());

  Map<String, dynamic> toPreviewJson() => {
    'storeId': storeId,
    'priceListId': priceListId,
    'lines': [for (final l in lines) l.toJson()],
    'discount': discount?.toJson(),
  };

  /// Body for POST /orders.
  Map<String, dynamic> toCreateOrderJson() => {
    'customerId': customer!.id,
    'storeId': storeId,
    'priceListId': priceListId,
    'lines': [for (final l in lines) l.toJson()],
    'discount': discount?.toJson(),
    'dueDate': dueDate.toUtc().toIso8601String(),
    'deliveryMode': DeliveryMode.storePickup.wire,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
    'payments': [
      if (payment != null && payment!.amount.isPositive)
        {
          'method': payment!.method.wire,
          'amount': payment!.amount.toApi(),
          if (payment!.reference?.trim().isNotEmpty ?? false) 'reference': payment!.reference!.trim(),
        },
    ],
    'idempotencyKey': idempotencyKey,
  };
}

/// Default due date: now + the business turnaround, rounded up to the next
/// hour on the business clock (so a 2:30 PM drop-off with 48 h becomes 3 PM).
DateTime defaultDueDate(int turnaroundHours, {DateTime? now}) {
  final t = BusinessTime.local((now ?? DateTime.now()).add(Duration(hours: turnaroundHours)));
  final rounded = BusinessTime.at(t.year, t.month, t.day, t.hour);
  return rounded.isBefore(t) ? rounded.add(const Duration(hours: 1)) : rounded;
}
