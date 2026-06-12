import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { LocationService } from './location.service';

@Module({
  providers: [TrackingGateway, LocationService],
  exports: [TrackingGateway, LocationService],
})
export class TrackingModule {}
