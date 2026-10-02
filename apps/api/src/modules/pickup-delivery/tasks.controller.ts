import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import { AssignTaskDto, ChangeTaskStatusDto, CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './tasks.dto';
import { TasksService } from './tasks.service';

@ApiTags('pickup-delivery')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequireAnyPermission(Permission.TASKS_VIEW_ALL, Permission.TASKS_VIEW_OWN)
  @Get()
  list(@CurrentUser() ctx: AuthContext, @Query() query: TaskListQueryDto) {
    return this.tasks.list(ctx, query);
  }

  @RequireAnyPermission(Permission.TASKS_VIEW_ALL, Permission.TASKS_VIEW_OWN)
  @Get('mine')
  mine(@CurrentUser() ctx: AuthContext, @Query('date') date?: string) {
    return this.tasks.myTasks(ctx, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined);
  }

  @RequireAnyPermission(Permission.TASKS_VIEW_ALL, Permission.TASKS_VIEW_OWN)
  @Get(':id')
  get(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(ctx, id);
  }

  @RequirePermissions(Permission.TASKS_MANAGE)
  @Post()
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateTaskDto) {
    return this.tasks.create(ctx, dto);
  }

  @RequirePermissions(Permission.TASKS_MANAGE)
  @Patch(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(ctx, id, dto);
  }

  @RequirePermissions(Permission.TASKS_MANAGE)
  @HttpCode(200)
  @Post(':id/assign')
  assign(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(ctx, id, dto);
  }

  @RequirePermissions(Permission.TASKS_UPDATE_STATUS)
  @HttpCode(200)
  @Post(':id/status')
  changeStatus(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeTaskStatusDto) {
    return this.tasks.changeStatus(ctx, id, dto);
  }
}
