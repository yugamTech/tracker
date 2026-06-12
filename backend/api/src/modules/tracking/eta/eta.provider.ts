import { Injectable } from '@nestjs/common';
import { haversineMeters } from '../../../common/geo.util';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EtaEstimate {
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * The single external call we deliberately stub for Phase 3. Swap the binding
 * in TrackingModule for a GoogleDirectionsEtaProvider later — the Redis cache
 * and one-compute-many-readers fan-out around it (EtaService) stay unchanged.
 */
export const ETA_PROVIDER = 'ETA_PROVIDER';

export interface EtaProvider {
  estimate(from: LatLng, to: LatLng): Promise<EtaEstimate>;
}

/**
 * Local estimate: straight-line distance scaled by a road-winding factor,
 * divided by an assumed average urban speed. No network, no API key, no cost.
 */
@Injectable()
export class HaversineEtaProvider implements EtaProvider {
  private readonly avgSpeedKmh = 22; // assumed average urban bus speed
  private readonly roadFactor = 1.35; // straight-line -> driving distance fudge

  async estimate(from: LatLng, to: LatLng): Promise<EtaEstimate> {
    const straight = haversineMeters(from.lat, from.lng, to.lat, to.lng);
    const distanceMeters = straight * this.roadFactor;
    const metersPerSec = (this.avgSpeedKmh * 1000) / 3600;
    return {
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(distanceMeters / metersPerSec),
    };
  }
}
