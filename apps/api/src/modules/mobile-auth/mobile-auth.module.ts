import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { mobileJwtSecret } from '../../config/env';
import { AuthModule } from '../auth/auth.module';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileAuthService } from './mobile-auth.service';
import { MOBILE_TOKEN_AUDIENCE, MOBILE_TOKEN_ISSUER, MobileTokenService } from './mobile-token.service';

/** Global so the app-wide AuthGuard can verify Bearer tokens. */
@Global()
@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: mobileJwtSecret(),
        signOptions: { algorithm: 'HS256', issuer: MOBILE_TOKEN_ISSUER, audience: MOBILE_TOKEN_AUDIENCE },
        verifyOptions: { algorithms: ['HS256'], issuer: MOBILE_TOKEN_ISSUER, audience: MOBILE_TOKEN_AUDIENCE },
      }),
    }),
  ],
  controllers: [MobileAuthController],
  providers: [MobileAuthService, MobileTokenService],
  exports: [MobileTokenService],
})
export class MobileAuthModule {}
