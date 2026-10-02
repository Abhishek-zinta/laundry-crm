import { Module } from '@nestjs/common';
import { GarmentsController } from './garments.controller';
import { GarmentsService } from './garments.service';

@Module({
  controllers: [GarmentsController],
  providers: [GarmentsService],
})
export class GarmentsModule {}
