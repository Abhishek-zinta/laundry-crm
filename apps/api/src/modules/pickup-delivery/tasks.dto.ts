import { assignTaskSchema, changeTaskStatusSchema, createTaskSchema, taskListQuerySchema, updateTaskSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateTaskDto extends createZodDto(createTaskSchema) {}
export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}
export class AssignTaskDto extends createZodDto(assignTaskSchema) {}
export class ChangeTaskStatusDto extends createZodDto(changeTaskStatusSchema) {}
export class TaskListQueryDto extends createZodDto(taskListQuerySchema) {}
