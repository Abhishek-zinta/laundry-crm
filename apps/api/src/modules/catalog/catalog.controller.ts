import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@rinseops/shared';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import {
  CreateCategoryDto,
  CreateItemDto,
  CreateModifierDto,
  CreatePriceListDto,
  PricePreviewDto,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateModifierDto,
  UpdatePriceListDto,
  UpsertPriceListItemsDto,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get()
  overview(@CurrentUser() ctx: AuthContext) {
    return this.catalog.overview(ctx);
  }

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get('pos')
  pos(
    @CurrentUser() ctx: AuthContext,
    @Query('priceListId') priceListId?: string,
    @Query('customerId') customerId?: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.catalog.pos(ctx, { priceListId, customerId, storeId });
  }

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Post('preview')
  preview(@CurrentUser() ctx: AuthContext, @Body() dto: PricePreviewDto) {
    return this.catalog.preview(ctx, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post('categories')
  createCategory(@CurrentUser() ctx: AuthContext, @Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(ctx, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch('categories/:id')
  updateCategory(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(ctx, id, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post('items')
  createItem(@CurrentUser() ctx: AuthContext, @Body() dto: CreateItemDto) {
    return this.catalog.createItem(ctx, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch('items/:id')
  updateItem(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto) {
    return this.catalog.updateItem(ctx, id, dto);
  }

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get('price-lists/:id')
  priceList(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.priceListMatrix(ctx, id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post('price-lists')
  createPriceList(@CurrentUser() ctx: AuthContext, @Body() dto: CreatePriceListDto) {
    return this.catalog.createPriceList(ctx, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch('price-lists/:id')
  updatePriceList(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePriceListDto) {
    return this.catalog.updatePriceList(ctx, id, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Put('price-lists/:id/prices')
  upsertPrices(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertPriceListItemsDto) {
    return this.catalog.upsertPrices(ctx, id, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post('modifiers')
  createModifier(@CurrentUser() ctx: AuthContext, @Body() dto: CreateModifierDto) {
    return this.catalog.createModifier(ctx, dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch('modifiers/:id')
  updateModifier(@CurrentUser() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModifierDto) {
    return this.catalog.updateModifier(ctx, id, dto);
  }
}
