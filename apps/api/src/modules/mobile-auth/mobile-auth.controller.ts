import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { AuthService } from '../auth/auth.service';
import { MobileLoginDto, MobileRefreshDto } from './mobile-auth.dto';
import { MobileAuthService } from './mobile-auth.service';

/**
 * Token endpoints for the native apps (Android, iOS). They never set cookies, so the
 * web's cookie + CSRF model is unaffected. Use `Authorization: Bearer <accessToken>`
 * on every other endpoint.
 */
@ApiTags('mobile-auth')
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(
    private readonly auth: MobileAuthService,
    private readonly session: AuthService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: MobileLoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, meta(req, dto.deviceName));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: MobileRefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('logout')
  async logout(@Body() dto: MobileRefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  /** Same payload as GET /auth/me; requires a Bearer access token. */
  @Get('me')
  me(@CurrentUser() ctx: AuthContext) {
    return this.session.me(ctx);
  }
}

function meta(req: Request, deviceName?: string) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'], deviceName };
}
