import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { LocationService } from './location.service';

@Module({
  imports: [JwtModule],
  controllers: [TrackingController],
  providers: [TrackingGateway, LocationService],
  exports: [TrackingGateway, LocationService],
})
export class TrackingModule {}
