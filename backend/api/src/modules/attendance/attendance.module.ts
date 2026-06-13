import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { StorageService } from '../../infra/storage/storage.service';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule, TrackingModule, NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, StorageService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
