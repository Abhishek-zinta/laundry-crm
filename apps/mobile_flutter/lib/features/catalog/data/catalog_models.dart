import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/format/money.dart';

part 'catalog_models.g.dart';

@apiModel
class PosItem {
  const PosItem({
    required this.serviceItemId,
    required this.name,
    required this.unitType,
    required this.piecesPerUnit,
    this.icon,
    required this.price,
  });
  final String serviceItemId;
  final String name;
  final UnitType unitType;
  final int piecesPerUnit;
  final String? icon;
  final Money price;

  factory PosItem.fromJson(Map<String, dynamic> json) => _$PosItemFromJson(json);
}

@apiModel
class PosCategory {
  const PosCategory({required this.id, required this.name, required this.code, this.color, required this.items});
  final String id;
  final String name;
  final String code;
  final String? color;
  final List<PosItem> items;

  factory PosCategory.fromJson(Map<String, dynamic> json) => _$PosCategoryFromJson(json);
}

@apiModel
class Modifier {
  const Modifier({required this.id, required this.name, required this.type, required this.value});
  final String id;
  final String name;
  final ModifierType type;
  final String value;

  String get label => type == ModifierType.percent ? '$name (+${num.parse(value).toStringAsFixed(0)}%)' : name;

  factory Modifier.fromJson(Map<String, dynamic> json) => _$ModifierFromJson(json);
}

@apiModel
class PriceListRef {
  const PriceListRef({required this.id, required this.name});
  final String id;
  final String name;

  factory PriceListRef.fromJson(Map<String, dynamic> json) => _$PriceListRefFromJson(json);
}

/// GET /catalog/pos — the price list resolved for a customer/store.
@apiModel
class PosCatalog {
  const PosCatalog({required this.priceList, required this.categories, required this.modifiers});
  final PriceListRef priceList;
  final List<PosCategory> categories;
  final List<Modifier> modifiers;

  factory PosCatalog.fromJson(Map<String, dynamic> json) => _$PosCatalogFromJson(json);
}

@apiModel
class PreviewLine {
  const PreviewLine({required this.lineTotal});
  final Money lineTotal;

  factory PreviewLine.fromJson(Map<String, dynamic> json) => _$PreviewLineFromJson(json);
}

/// POST /catalog/preview — authoritative server-side totals.
@apiModel
class PricingPreview {
  const PricingPreview({
    this.lines = const [],
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.grandTotal,
  });

  /// Same order as the request's lines; includes modifiers.
  final List<PreviewLine> lines;
  final Money subtotal;
  final Money discountAmount;
  final Money taxAmount;
  final Money grandTotal;

  factory PricingPreview.fromJson(Map<String, dynamic> json) => _$PricingPreviewFromJson(json);
}
