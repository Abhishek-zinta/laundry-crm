import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditModule } from './common/audit/audit.module';
import { AuthGuard } from './common/auth/auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { AllExceptionsFilter } from './common/errors/http-exception.filter';
import { OriginCheckMiddleware } from './common/http/origin.middleware';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditApiModule } from './modules/audit/audit-api.module';
import { AuthModule } from './modules/auth/auth.module';
import { MobileAuthModule } from './modules/mobile-auth/mobile-auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GarmentsModule } from './modules/garments/garments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TasksModule } from './modules/pickup-delivery/tasks.module';
import { PublicModule } from './modules/public/public.module';
import { RacksModule } from './modules/racks/racks.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SearchModule } from './modules/search/search.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Generous global limit; sensitive endpoints override with @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
      // Automated tests log in many times from one IP.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuditModule,
    WorkflowModule,
    AuthModule,
    MobileAuthModule,
    TenantsModule,
    UsersModule,
    CustomersModule,
    CatalogModule,
    OrdersModule,
    GarmentsModule,
    PaymentsModule,
    RacksModule,
    TasksModule,
    PublicModule,
    SearchModule,
    DashboardModule,
    ReportsModule,
    AuditApiModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware).forRoutes('*path');
  }
}
