import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/auth/decorators';
import { PublicBookingDto } from './public.dto';
import { PublicService } from './public.service';

@ApiTags('public')
@Public()
@Controller('public/tenants/:slug')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  profile(@Param('slug') slug: string) {
    return this.publicService.tenantProfile(slug);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('bookings')
  book(@Param('slug') slug: string, @Body() dto: PublicBookingDto, @Req() req: Request) {
    return this.publicService.book(slug, dto, req.ip);
  }
}
