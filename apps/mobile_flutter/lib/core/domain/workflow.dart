import 'enums.dart';

/// Driver actions on a pickup/delivery task. Mirrors the server's task
/// workflow (packages/shared/src/workflow.ts); the server still validates.
enum DriverAction {
  start('Start'),
  pickedUp('Picked up'),
  delivered('Delivered'),
  failed('Failed');

  const DriverAction(this.label);
  final String label;
}

List<DriverAction> driverActionsFor(TaskType type, TaskStatus status) {
  switch (status) {
    case TaskStatus.scheduled:
    case TaskStatus.assigned:
      return const [DriverAction.start];
    case TaskStatus.outForPickup:
      return type == TaskType.pickup ? const [DriverAction.pickedUp, DriverAction.failed] : const [];
    case TaskStatus.outForDelivery:
      return type == TaskType.delivery ? const [DriverAction.delivered, DriverAction.failed] : const [];
    default:
      return const [];
  }
}

/// The task status a driver action moves to.
TaskStatus targetStatus(TaskType type, DriverAction action) => switch (action) {
  DriverAction.start => type == TaskType.pickup ? TaskStatus.outForPickup : TaskStatus.outForDelivery,
  DriverAction.pickedUp => TaskStatus.pickedUp,
  DriverAction.delivered => TaskStatus.delivered,
  DriverAction.failed => TaskStatus.failed,
};
