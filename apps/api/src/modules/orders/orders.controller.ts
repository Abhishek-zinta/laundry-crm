import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderStatus, Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { WorkflowService } from '../workflow/workflow.service';
import { CancelOrderDto, ChangeOrderStatusDto, CreateOrderDto, OrderListQueryDto, UpdateOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly workflow: WorkflowService,
  ) {}

  @RequirePermissions(Permission.ORDERS_VIEW)
  @Get()
  list(@CurrentUser() ctx: AuthContext, @Query() query: OrderListQueryDto) {
    return this.orders.list(ctx, query);
  }

  @RequirePermissions(Permission.ORDERS_VIEW)
  @Get('by-number/:orderNumber')
  byNumber(@CurrentUser() ctx: AuthContext, @Param('orderNumber') orderNumber: string) {
    return this.orders.getByNumber(ctx, orderNumber);
  }

  @RequirePermissions(Permission.ORDERS_VIEW)
  @Get(':id')
  get(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(ctx, id);
  }

  @RequirePermissions(Permission.ORDERS_CREATE)
  @Post()
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateOrderDto) {
    return this.orders.create(ctx, dto);
  }

  @RequirePermissions(Permission.ORDERS_EDIT)
  @Patch(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(ctx, id, dto);
  }

  /** Permission depends on the target status and is checked by the workflow service. */
  @RequirePermissions(Permission.ORDERS_VIEW)
  @HttpCode(200)
  @Post(':id/status')
  async changeStatus(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeOrderStatusDto) {
    await this.workflow.changeStatus(ctx, id, dto.status, { note: dto.note, allowOutstanding: dto.allowOutstanding });
    return this.orders.get(ctx, id);
  }

  @RequirePermissions(Permission.ORDERS_CANCEL)
  @HttpCode(200)
  @Post(':id/cancel')
  async cancel(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    await this.workflow.changeStatus(ctx, id, OrderStatus.CANCELLED, { note: dto.reason });
    return this.orders.get(ctx, id);
  }
}
