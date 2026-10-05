// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'task_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TaskCustomer _$TaskCustomerFromJson(Map<String, dynamic> json) => TaskCustomer(
  id: json['id'] as String,
  firstName: json['firstName'] as String,
  lastName: json['lastName'] as String?,
  phone: json['phone'] as String,
  alternatePhone: json['alternatePhone'] as String?,
);

TaskOrder _$TaskOrderFromJson(Map<String, dynamic> json) => TaskOrder(
  id: json['id'] as String,
  orderNumber: json['orderNumber'] as String,
  status: const OrderStatusConverter().fromJson(json['status'] as String),
  balanceDue: const MoneyConverter().fromJson(json['balanceDue'] as String),
  totalPieces: (json['totalPieces'] as num).toInt(),
);

DriverTask _$DriverTaskFromJson(Map<String, dynamic> json) => DriverTask(
  id: json['id'] as String,
  type: const TaskTypeConverter().fromJson(json['type'] as String),
  status: const TaskStatusConverter().fromJson(json['status'] as String),
  address: json['address'] as String,
  scheduledDate: json['scheduledDate'] as String,
  timeSlot: json['timeSlot'] as String,
  requestedService: json['requestedService'] as String?,
  notes: json['notes'] as String?,
  failureReason: json['failureReason'] as String?,
  customer: TaskCustomer.fromJson(json['customer'] as Map<String, dynamic>),
  store: StoreRef.fromJson(json['store'] as Map<String, dynamic>),
  order: json['order'] == null
      ? null
      : TaskOrder.fromJson(json['order'] as Map<String, dynamic>),
);
