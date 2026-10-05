import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { allowedOrigins, trustProxySetting } from './config/env';

export const API_PREFIX = 'api/v1';

/** Shared HTTP setup for the real server and the e2e tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  const instance = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  // Which reverse proxies (Next.js, nginx, a load balancer) may report the client IP.
  // Client IPs drive login rate limiting and audit logs; see TRUST_PROXY.
  instance.set?.('trust proxy', trustProxySetting());
  app.enableShutdownHooks();
}
