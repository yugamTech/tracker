import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [JwtModule, TrackingModule],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
