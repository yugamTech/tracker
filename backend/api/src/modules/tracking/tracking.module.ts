import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { LocationService } from './location.service';
import { GeofenceService } from './geofence.service';
import { EtaService } from './eta.service';
import { SpeedService } from './speed.service';
import { SignalLossService } from './signal-loss.service';
import { ETA_PROVIDER, HaversineEtaProvider } from './eta/eta.provider';

@Module({
  imports: [JwtModule],
  controllers: [TrackingController],
  providers: [
    TrackingGateway,
    LocationService,
    GeofenceService,
    EtaService,
    SpeedService,
    SignalLossService,
    // Stubbed external ETA call — swap for a GoogleDirectionsEtaProvider later.
    { provide: ETA_PROVIDER, useClass: HaversineEtaProvider },
  ],
  exports: [TrackingGateway, LocationService, GeofenceService],
})
export class TrackingModule {}
