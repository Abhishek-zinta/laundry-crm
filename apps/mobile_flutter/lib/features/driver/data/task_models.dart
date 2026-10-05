import '../../../core/domain/api_model.dart';
import '../../../core/domain/enums.dart';
import '../../../core/domain/refs.dart';
import '../../../core/format/money.dart';

part 'task_models.g.dart';

@apiModel
class TaskCustomer extends CustomerRef {
  const TaskCustomer({required super.id, required super.firstName, super.lastName, required super.phone, this.alternatePhone});
  final String? alternatePhone;

  factory TaskCustomer.fromJson(Map<String, dynamic> json) => _$TaskCustomerFromJson(json);
}

@apiModel
class TaskOrder {
  const TaskOrder({required this.id, required this.orderNumber, required this.status, required this.balanceDue, required this.totalPieces});
  final String id;
  final String orderNumber;
  final OrderStatus status;
  final Money balanceDue;
  final int totalPieces;

  factory TaskOrder.fromJson(Map<String, dynamic> json) => _$TaskOrderFromJson(json);
}

@apiModel
class DriverTask {
  const DriverTask({
    required this.id,
    required this.type,
    required this.status,
    required this.address,
    required this.scheduledDate,
    required this.timeSlot,
    this.requestedService,
    this.notes,
    this.failureReason,
    required this.customer,
    required this.store,
    this.order,
  });
  final String id;
  final TaskType type;
  final TaskStatus status;
  final String address;

  /// Calendar date (YYYY-MM-DD) in the business time zone.
  final String scheduledDate;
  final String timeSlot;
  final String? requestedService;
  final String? notes;
  final String? failureReason;
  final TaskCustomer customer;
  final StoreRef store;
  final TaskOrder? order;

  factory DriverTask.fromJson(Map<String, dynamic> json) => _$DriverTaskFromJson(json);
}
