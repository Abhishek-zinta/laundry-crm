import 'package:flutter/material.dart';

/// The RinseOps wave mark on its teal tile (same artwork as the web favicon
/// and the launcher icon; rendered by tool/render_brand.py).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56});
  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/branding/splash_logo.png',
    width: size,
    height: size,
    filterQuality: FilterQuality.medium,
    semanticLabel: 'RinseOps',
  );
}
