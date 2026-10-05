// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PosItem _$PosItemFromJson(Map<String, dynamic> json) => PosItem(
  serviceItemId: json['serviceItemId'] as String,
  name: json['name'] as String,
  unitType: const UnitTypeConverter().fromJson(json['unitType'] as String),
  piecesPerUnit: (json['piecesPerUnit'] as num).toInt(),
  icon: json['icon'] as String?,
  price: const MoneyConverter().fromJson(json['price'] as String),
);

PosCategory _$PosCategoryFromJson(Map<String, dynamic> json) => PosCategory(
  id: json['id'] as String,
  name: json['name'] as String,
  code: json['code'] as String,
  color: json['color'] as String?,
  items: (json['items'] as List<dynamic>)
      .map((e) => PosItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Modifier _$ModifierFromJson(Map<String, dynamic> json) => Modifier(
  id: json['id'] as String,
  name: json['name'] as String,
  type: const ModifierTypeConverter().fromJson(json['type'] as String),
  value: json['value'] as String,
);

PriceListRef _$PriceListRefFromJson(Map<String, dynamic> json) =>
    PriceListRef(id: json['id'] as String, name: json['name'] as String);

PosCatalog _$PosCatalogFromJson(Map<String, dynamic> json) => PosCatalog(
  priceList: PriceListRef.fromJson(json['priceList'] as Map<String, dynamic>),
  categories: (json['categories'] as List<dynamic>)
      .map((e) => PosCategory.fromJson(e as Map<String, dynamic>))
      .toList(),
  modifiers: (json['modifiers'] as List<dynamic>)
      .map((e) => Modifier.fromJson(e as Map<String, dynamic>))
      .toList(),
);

PreviewLine _$PreviewLineFromJson(Map<String, dynamic> json) => PreviewLine(
  lineTotal: const MoneyConverter().fromJson(json['lineTotal'] as String),
);

PricingPreview _$PricingPreviewFromJson(Map<String, dynamic> json) =>
    PricingPreview(
      lines:
          (json['lines'] as List<dynamic>?)
              ?.map((e) => PreviewLine.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      subtotal: const MoneyConverter().fromJson(json['subtotal'] as String),
      discountAmount: const MoneyConverter().fromJson(
        json['discountAmount'] as String,
      ),
      taxAmount: const MoneyConverter().fromJson(json['taxAmount'] as String),
      grandTotal: const MoneyConverter().fromJson(json['grandTotal'] as String),
    );
