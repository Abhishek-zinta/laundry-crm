import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { env, SESSION_COOKIE } from '../../config/env';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.register(dto, meta(req));
    setSessionCookie(res, session.token, session.expiresAt);
    return { ok: true, home: session.home };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto, meta(req));
    setSessionCookie(res, session.token, session.expiresAt);
    return { ok: true, home: session.home };
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() ctx: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(ctx.sessionId);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() ctx: AuthContext) {
    return this.auth.me(ctx);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('change-password')
  async changePassword(@CurrentUser() ctx: AuthContext, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(ctx, dto);
    return { ok: true };
  }
}

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env().COOKIE_SECURE, path: '/' };
}

function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}
