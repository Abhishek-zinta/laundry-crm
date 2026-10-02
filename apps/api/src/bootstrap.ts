import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { allowedOrigins } from './config/env';

export const API_PREFIX = 'api/v1';

/** Shared HTTP setup for the real server and the e2e tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  const instance = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  // Behind the Next.js proxy / a load balancer; needed for correct client IPs.
  instance.set?.('trust proxy', 'loopback');
  app.enableShutdownHooks();
}
