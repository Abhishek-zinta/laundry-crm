import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { CreatePaymentDto, PaymentListQueryDto, RefundPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @RequirePermissions(Permission.PAYMENTS_VIEW)
  @Get()
  list(@CurrentUser() ctx: AuthContext, @Query() query: PaymentListQueryDto) {
    return this.payments.list(ctx, query);
  }

  @RequirePermissions(Permission.PAYMENTS_CREATE)
  @Post()
  record(@CurrentUser() ctx: AuthContext, @Body() dto: CreatePaymentDto) {
    return this.payments.record(ctx, dto);
  }

  @RequirePermissions(Permission.PAYMENTS_REFUND)
  @HttpCode(200)
  @Post(':id/refund')
  refund(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto) {
    return this.payments.refund(ctx, id, dto);
  }
}
