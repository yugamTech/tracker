import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Infra
import { PrismaModule } from './infra/database/prisma.module';
import { RedisModule } from './infra/redis/redis.module';

// Common middleware
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { TripsModule } from './modules/trips/trips.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DailyChecksModule } from './modules/daily-checks/daily-checks.module';
import { DriverProfilesModule } from './modules/driver-profiles/driver-profiles.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Config — load .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Scheduling (cron jobs)
    ScheduleModule.forRoot(),

    // Infra
    PrismaModule,
    RedisModule,

    // Feature modules
    AuthModule,
    IdentityModule,
    OnboardingModule,
    TripsModule,
    TrackingModule,
    AttendanceModule,
    DailyChecksModule,
    DriverProfilesModule,
    NotificationsModule,
    ComplaintsModule,
    PaymentsModule,
    AnalyticsModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'api/v1/auth/(.*)', method: RequestMethod.ALL },
        { path: 'api/v1/health', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
