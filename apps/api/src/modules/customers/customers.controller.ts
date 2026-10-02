import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { AddressDto, CreateCustomerDto, CustomerListQueryDto, UpdateAddressDto, UpdateCustomerDto } from './customers.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions(Permission.CUSTOMERS_VIEW)
  @Get()
  list(@CurrentUser() ctx: AuthContext, @Query() query: CustomerListQueryDto) {
    return this.customers.list(ctx, query);
  }

  @RequirePermissions(Permission.CUSTOMERS_VIEW)
  @Get('lookup')
  async lookup(@CurrentUser() ctx: AuthContext, @Query('phone') phone = '') {
    return { customer: phone.trim() ? await this.customers.lookupByPhone(ctx, phone) : null };
  }

  @RequirePermissions(Permission.CUSTOMERS_VIEW)
  @Get(':id')
  get(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(ctx, id);
  }

  @RequirePermissions(Permission.CUSTOMERS_VIEW, Permission.PAYMENTS_VIEW)
  @Get(':id/payments')
  payments(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.payments(ctx, id);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Post()
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateCustomerDto) {
    return this.customers.create(ctx, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Patch(':id')
  update(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(ctx, id, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Post(':id/addresses')
  addAddress(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddressDto) {
    return this.customers.addAddress(ctx, id, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Patch(':id/addresses/:addressId')
  updateAddress(
    @CurrentUser() ctx: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(ctx, id, addressId, dto);
  }

  @RequirePermissions(Permission.CUSTOMERS_MANAGE)
  @Delete(':id/addresses/:addressId')
  removeAddress(
    @CurrentUser() ctx: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.customers.removeAddress(ctx, id, addressId);
  }
}
