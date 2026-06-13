import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule, TrackingModule, NotificationsModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
