import { Injectable, Inject, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import { LocationService, type LatestPosition } from './location.service';
import { ETA_PROVIDER, type EtaProvider } from './eta/eta.provider';

export interface EtaResult {
  tripId: string;
  stopId: string;
  stopName: string;
  etaSeconds: number;
  etaMinutes: number;
  distanceMeters: number;
  etaTs: string;
}

// 2-minute cache window — one external estimate per (trip, stop) serves every
// subscribed parent until it expires.
const ETA_TTL_SECONDS = 120;

@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);
  // Coalesce concurrent cache-misses for the same key into one provider call.
  private readonly inflight = new Map<string, Promise<EtaResult | null>>();

  constructor(
    private readonly location: LocationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(ETA_PROVIDER) private readonly provider: EtaProvider,
  ) {}

  /**
   * ETA from the current position to the next not-yet-departed stop.
   * Reads the 2-min Redis cache first; on a miss, a single coalesced call hits
   * the (stubbed) provider and the result is cached + returned for fan-out.
   */
  async computeForNextStop(latest: LatestPosition): Promise<EtaResult | null> {
    const target = await this.nextStop(latest.tripId);
    if (!target) return null;

    const key = `eta:${latest.tripId}:${target.stopId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as EtaResult;

    if (this.inflight.has(key)) return this.inflight.get(key)!;
    const promise = this.computeAndCache(key, latest, target).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private async computeAndCache(
    key: string,
    latest: LatestPosition,
    target: { stopId: string; name: string; lat: number; lng: number },
  ): Promise<EtaResult | null> {
    const est = await this.provider.estimate(
      { lat: latest.lat, lng: latest.lng },
      { lat: target.lat, lng: target.lng },
    );
    const result: EtaResult = {
      tripId: latest.tripId,
      stopId: target.stopId,
      stopName: target.name,
      etaSeconds: est.durationSeconds,
      etaMinutes: Math.max(1, Math.round(est.durationSeconds / 60)),
      distanceMeters: est.distanceMeters,
      etaTs: latest.deviceTs,
    };
    await this.redis.setex(key, ETA_TTL_SECONDS, JSON.stringify(result));
    this.logger.debug(`eta ${latest.tripId} -> ${target.name}: ${result.etaMinutes}min (computed)`);
    return result;
  }

  /** First stop (by sequence) whose geofence state is not yet AT_STOP/DEPARTED. */
  private async nextStop(tripId: string) {
    const stops = await this.location.getTripStops(tripId);
    for (const stop of stops) {
      const state = await this.redis.get(`geofence:${tripId}:${stop.stopId}`);
      if (state !== 'AT_STOP' && state !== 'DEPARTED') return stop;
    }
    return null;
  }
}
