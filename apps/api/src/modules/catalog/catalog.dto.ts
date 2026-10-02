import {
  createModifierSchema,
  createPriceListSchema,
  createServiceCategorySchema,
  createServiceItemSchema,
  pricePreviewSchema,
  updateModifierSchema,
  updatePriceListSchema,
  updateServiceCategorySchema,
  updateServiceItemSchema,
  upsertPriceListItemsSchema,
} from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCategoryDto extends createZodDto(createServiceCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(updateServiceCategorySchema) {}
export class CreateItemDto extends createZodDto(createServiceItemSchema) {}
export class UpdateItemDto extends createZodDto(updateServiceItemSchema) {}
export class CreatePriceListDto extends createZodDto(createPriceListSchema) {}
export class UpdatePriceListDto extends createZodDto(updatePriceListSchema) {}
export class UpsertPriceListItemsDto extends createZodDto(upsertPriceListItemsSchema) {}
export class CreateModifierDto extends createZodDto(createModifierSchema) {}
export class UpdateModifierDto extends createZodDto(updateModifierSchema) {}
export class PricePreviewDto extends createZodDto(pricePreviewSchema) {}
