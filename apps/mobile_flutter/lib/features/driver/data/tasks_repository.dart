import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/domain/enums.dart';
import 'task_models.dart';

final tasksRepositoryProvider = Provider<TasksRepository>((ref) => ApiTasksRepository(ref.watch(apiClientProvider)));

/// Driver task data source; cache-ready (see OrdersRepository). A future
/// offline mode would queue status changes here and sync them in the background.
abstract interface class TasksRepository {
  /// Today's tasks assigned to the signed-in driver, plus overdue open ones.
  Future<List<DriverTask>> myTasks();
  Future<void> changeStatus(String taskId, TaskStatus status, {String? note});
}

class ApiTasksRepository implements TasksRepository {
  ApiTasksRepository(this._api);
  final ApiClient _api;

  @override
  Future<List<DriverTask>> myTasks() async {
    final json = await _api.get<Map<String, dynamic>>('/tasks/mine');
    return (json['items'] as List).map((e) => DriverTask.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> changeStatus(String taskId, TaskStatus status, {String? note}) => _api.post<void>(
    '/tasks/$taskId/status',
    body: {'status': status.wire, if (note != null && note.trim().isNotEmpty) 'note': note.trim()},
  );
}
