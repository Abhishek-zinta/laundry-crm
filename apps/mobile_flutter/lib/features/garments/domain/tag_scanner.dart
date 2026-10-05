import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/dialogs.dart';

/// Source of garment tag codes. Today it's manual entry; a camera-based
/// QR/barcode implementation (e.g. mobile_scanner) can replace it by
/// overriding [tagScannerProvider], with no change to the screens using it.
abstract interface class TagScanner {
  /// Whether this scanner uses the camera (screens show a scan icon if so).
  bool get usesCamera;

  /// Returns a tag code, or null if the user cancelled.
  Future<String?> scan(BuildContext context);
}

final tagScannerProvider = Provider<TagScanner>((ref) => const ManualTagEntry());

class ManualTagEntry implements TagScanner {
  const ManualTagEntry();

  @override
  bool get usesCamera => false;

  @override
  Future<String?> scan(BuildContext context) => askText(
    context,
    title: 'Enter tag code',
    label: 'Tag code',
    hint: 'e.g. GAR-000123',
    icon: Icons.sell_outlined,
    action: 'Find',
    cancel: 'Cancel',
    maxLines: 1,
    capitalization: TextCapitalization.characters,
  );
}
