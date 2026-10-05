import 'package:dio/dio.dart';

/// A failure the UI can show. Built from the API's error envelope
/// `{ statusCode, error: { code, message, details? } }` or from transport errors.
class AppException implements Exception {
  const AppException(this.message, {this.code = 'UNKNOWN', this.statusCode, this.details});

  final String message;
  final String code;
  final int? statusCode;
  final Object? details;

  bool get isNetwork => code == 'NETWORK';
  bool get isUnauthorized => statusCode == 401;

  factory AppException.from(Object error) {
    if (error is AppException) return error;
    if (error is DioException) return AppException.fromDio(error);
    return AppException('Something went wrong. Please try again.', details: error.toString());
  }

  factory AppException.fromDio(DioException e) {
    if (e.error is AppException) return e.error! as AppException;
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const AppException("Can't reach the RinseOps server. Check your connection and try again.", code: 'NETWORK');
      case DioExceptionType.cancel:
        return const AppException('Request cancelled.', code: 'CANCELLED');
      default:
        break;
    }
    final status = e.response?.statusCode;
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return AppException(
        (err['message'] as String?) ?? 'Request failed.',
        code: (err['code'] as String?) ?? 'HTTP_$status',
        statusCode: status,
        details: err['details'],
      );
    }
    if (data is Map && data['message'] is String) {
      return AppException(data['message'] as String, code: 'HTTP_$status', statusCode: status);
    }
    return AppException(
      status == null ? 'Something went wrong. Please try again.' : 'Request failed ($status).',
      code: 'HTTP_${status ?? 'ERROR'}',
      statusCode: status,
    );
  }

  @override
  String toString() => 'AppException($code, $statusCode): $message';
}
