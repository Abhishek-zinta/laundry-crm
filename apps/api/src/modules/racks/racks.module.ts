import { Module } from '@nestjs/common';
import { RacksController } from './racks.controller';
import { RacksService } from './racks.service';

@Module({
  controllers: [RacksController],
  providers: [RacksService],
})
export class RacksModule {}
