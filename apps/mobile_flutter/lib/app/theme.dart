import 'package:flutter/material.dart';

import '../core/domain/enums.dart';

/// RinseOps brand teal, matching the web app.
const brandSeed = Color(0xFF0F766E);

ThemeData buildTheme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(seedColor: brandSeed, brightness: brightness);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    visualDensity: VisualDensity.standard,
    appBarTheme: AppBarTheme(centerTitle: false, backgroundColor: scheme.surface, scrolledUnderElevation: 2),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(64, 48))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(64, 48))),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    listTileTheme: const ListTileThemeData(contentPadding: EdgeInsets.symmetric(horizontal: 16)),
  );
}

/// Semantic colours for status chips; consistent across light/dark.
class StatusColors {
  const StatusColors(this.background, this.foreground);
  final Color background;
  final Color foreground;

  static StatusColors _tone(ColorScheme s, Color base) {
    final dark = s.brightness == Brightness.dark;
    return StatusColors(
      Color.alphaBlend(base.withValues(alpha: dark ? 0.28 : 0.14), s.surface),
      dark ? Color.lerp(base, Colors.white, 0.45)! : Color.lerp(base, Colors.black, 0.35)!,
    );
  }

  static const _blue = Color(0xFF2563EB);
  static const _amber = Color(0xFFD97706);
  static const _violet = Color(0xFF7C3AED);
  static const _green = Color(0xFF16A34A);
  static const _grey = Color(0xFF64748B);
  static const _red = Color(0xFFDC2626);

  static StatusColors danger(ColorScheme s) => _tone(s, _red);
  static StatusColors neutral(ColorScheme s) => _tone(s, _grey);

  static StatusColors order(ColorScheme s, OrderStatus status) => _tone(s, switch (status) {
    OrderStatus.received => _blue,
    OrderStatus.processing => _amber,
    OrderStatus.qualityCheck => _violet,
    OrderStatus.ready => _green,
    OrderStatus.delivered => _grey,
    OrderStatus.cancelled => _red,
    OrderStatus.unknown => _grey,
  });

  static StatusColors payment(ColorScheme s, OrderPaymentStatus status) => _tone(s, switch (status) {
    OrderPaymentStatus.paid => _green,
    OrderPaymentStatus.partial => _amber,
    OrderPaymentStatus.unpaid => _red,
    OrderPaymentStatus.unknown => _grey,
  });

  static StatusColors task(ColorScheme s, TaskStatus status) => _tone(s, switch (status) {
    TaskStatus.scheduled || TaskStatus.assigned => _blue,
    TaskStatus.outForPickup || TaskStatus.outForDelivery => _amber,
    TaskStatus.pickedUp || TaskStatus.delivered => _green,
    TaskStatus.failed => _red,
    _ => _grey,
  });
}
