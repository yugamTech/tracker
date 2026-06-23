import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import type { LatestPosition } from './location.service';
import { haversineMeters, speedKmh } from '../../common/geo.util';
import type { AlertPayload } from '@yaanam/types';

// Ground speed is derived from consecutive fixes (unit-free) rather than the
// device's self-reported speed field, whose units we can't trust across clients.
const SPEED_THRESHOLD_KMH = 60;
// Ignore implausible jumps (GPS teleport) above this — they're bad fixes, not speed.
const MAX_PLAUSIBLE_KMH = 200;
const PREV_TTL_SECONDS = 3600;
// At most one over-speed alert per trip per this window.
const ALERT_DEBOUNCE_SECONDS = 30;

interface PrevFix {
  lat: number;
  lng: number;
  deviceTs: string;
}

@Injectable()
export class SpeedService {
  private readonly logger = new Logger(SpeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Derive ground speed from the previous fix; if it exceeds the threshold,
   * record a speed_event and return a (debounced) over-speed alert to emit.
   */
  async evaluate(latest: LatestPosition): Promise<AlertPayload | null> {
    const prevKey = `speed:${latest.tripId}:prev`;
    const prevRaw = await this.redis.get(prevKey);
    const prev = prevRaw ? (JSON.parse(prevRaw) as PrevFix) : null;

    const prevFix: PrevFix = { lat: latest.lat, lng: latest.lng, deviceTs: latest.deviceTs };
    await this.redis.setex(prevKey, PREV_TTL_SECONDS, JSON.stringify(prevFix));
    if (!prev) return null;

    const distance = haversineMeters(prev.lat, prev.lng, latest.lat, latest.lng);
    const deltaMs = new Date(latest.deviceTs).getTime() - new Date(prev.deviceTs).getTime();
    const kmh = speedKmh(distance, deltaMs);
    if (kmh < SPEED_THRESHOLD_KMH || kmh > MAX_PLAUSIBLE_KMH) return null;

    await this.prisma.speedEvent.create({
      data: {
        tripId: latest.tripId,
        tenantId: latest.tenantId,
        speedKmh: Math.round(kmh),
        thresholdKmh: SPEED_THRESHOLD_KMH,
        lat: latest.lat,
        lng: latest.lng,
      },
    });

    // Debounce the live alert (the event row is always written for the record).
    const fresh = await this.redis.set(
      `speed:${latest.tripId}:alerted`,
      '1',
      'EX',
      ALERT_DEBOUNCE_SECONDS,
      'NX',
    );
    if (!fresh) return null;

    this.logger.warn(`Over-speed on ${latest.tripId}: ${Math.round(kmh)} km/h`);
    return {
      tripId: latest.tripId,
      tenantId: latest.tenantId,
      type: 'OVERSPEED',
      message: `Bus exceeded ${SPEED_THRESHOLD_KMH} km/h (recorded ${Math.round(kmh)} km/h)`,
      ts: latest.deviceTs,
    };
  }
}
