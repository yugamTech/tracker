import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import { LocationService } from './location.service';
import { TrackingGateway } from './tracking.gateway';

// A trip is considered to have lost signal if no fix has landed in this long.
const SIGNAL_LOSS_THRESHOLD_MS = 60_000;
const SWEEP_INTERVAL_MS = 30_000;
const FLAG_TTL_SECONDS = 6 * 3600;

@Injectable()
export class SignalLossService {
  private readonly logger = new Logger(SignalLossService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly location: LocationService,
    private readonly gateway: TrackingGateway,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Periodically sweep active trips: alert once when a trip's last fix ages
   * past the threshold, and clear the flag (logging recovery) once fixes
   * resume — so an interrupted-then-restored bus produces exactly one alert.
   */
  @Interval('signal-loss-sweep', SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    const active = await this.prisma.trip.findMany({
      where: { status: { in: ['STARTED', 'IN_PROGRESS'] } },
      select: { id: true, tenantId: true },
    });
    const now = Date.now();

    for (const trip of active) {
      const latest = await this.location.getLatest(trip.id);
      if (!latest) continue; // no fixes yet — nothing to lose

      const ageMs = now - new Date(latest.serverTs).getTime();
      const flagKey = `signal:${trip.id}:lost`;
      const flagged = await this.redis.get(flagKey);

      if (ageMs > SIGNAL_LOSS_THRESHOLD_MS && !flagged) {
        await this.redis.setex(flagKey, FLAG_TTL_SECONDS, '1');
        this.logger.warn(`Signal lost on ${trip.id} (${Math.round(ageMs / 1000)}s since last fix)`);
        this.gateway.emitAlert(trip.id, trip.tenantId, {
          tripId: trip.id,
          tenantId: trip.tenantId,
          type: 'SIGNAL_LOST',
          message: `No GPS signal for ${Math.round(ageMs / 1000)}s`,
          ts: new Date(now).toISOString(),
        });
      } else if (ageMs <= SIGNAL_LOSS_THRESHOLD_MS && flagged) {
        await this.redis.del(flagKey);
        this.logger.log(`Signal recovered on ${trip.id}`);
      }
    }
  }
}
