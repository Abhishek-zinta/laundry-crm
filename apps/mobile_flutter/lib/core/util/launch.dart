import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

// Every launch goes to an external app (dialer, maps, browser). The app never
// shows web content itself; url_launcher's in-app WebViewActivity is removed
// from the Android manifest.

/// Opens the native dialer with [phone] pre-filled. Returns false if no app can handle it.
Future<bool> dialPhone(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^\d+]'), '');
  return launchUrl(
    Uri(scheme: 'tel', path: digits),
    mode: LaunchMode.externalApplication,
  );
}

/// Opens [address] in the native maps app: a `geo:` intent on Android
/// (Google Maps or any maps app), Apple Maps on iOS.
Future<bool> openMaps(String address) async {
  final query = Uri.encodeComponent(address);
  if (defaultTargetPlatform == TargetPlatform.iOS) {
    return launchUrl(Uri.parse('https://maps.apple.com/?q=$query'), mode: LaunchMode.externalApplication);
  }
  final geo = Uri.parse('geo:0,0?q=$query');
  if (await canLaunchUrl(geo)) return launchUrl(geo, mode: LaunchMode.externalApplication);
  return launchUrl(Uri.parse('https://www.google.com/maps/search/?api=1&query=$query'), mode: LaunchMode.externalApplication);
}
