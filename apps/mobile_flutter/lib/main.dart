import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/config/app_config.dart';
import 'core/format/business_time.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  await initializeDateFormatting();
  BusinessTime.initialize();
  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      // Screens show errors with an explicit "Try again" instead of silent retries.
      retry: (_, _) => null,
      child: const RinseOpsApp(),
    ),
  );
}
