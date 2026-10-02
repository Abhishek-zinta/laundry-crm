import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PricingService } from './pricing.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, PricingService],
  exports: [PricingService],
})
export class CatalogModule {}
