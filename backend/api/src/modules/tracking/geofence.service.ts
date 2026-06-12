import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import { LocationService, type LatestPosition } from './location.service';
import { haversineMeters } from '../../common/geo.util';

type GeofenceState = 'ABSENT' | 'APPROACHING' | 'AT_STOP' | 'DEPARTED';

export interface GeofenceTransition {
  tripId: string;
  stopId: string;
  stopName: string;
  event: 'APPROACHING' | 'AT_STOP' | 'DEPARTED';
  ts: string;
  /** Riders auto-marked NOT_BOARDED because the bus left their stop (DEPARTED only). */
  notBoarded?: { studentId: string; studentName: string }[];
}

const STATE_TTL_SECONDS = 6 * 3600;
// Hysteresis multipliers applied to a stop's configured geofence radius.
const APPROACH_FACTOR = 3; // within 3x radius -> APPROACHING
const DEPART_FACTOR = 1.5; // must clear 1.5x radius before counting as DEPARTED

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly location: LocationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Evaluate a position against the trip's stops and emit hysteresis-gated
   * transitions. State is monotonic per stop (ABSENT -> APPROACHING -> AT_STOP
   * -> DEPARTED), so a bus idling on the geofence edge can't flap events.
   * Each transition is persisted to geofence_events.
   */
  async evaluate(latest: LatestPosition): Promise<GeofenceTransition[]> {
    const stops = await this.location.getTripStops(latest.tripId);
    const transitions: GeofenceTransition[] = [];

    for (const stop of stops) {
      const key = `geofence:${latest.tripId}:${stop.stopId}`;
      const current = ((await this.redis.get(key)) as GeofenceState | null) ?? 'ABSENT';
      if (current === 'DEPARTED') continue; // terminal — done with this stop

      const dist = haversineMeters(latest.lat, latest.lng, stop.lat, stop.lng);
      const next = this.nextState(current, dist, stop.radius);
      if (next === current) continue;

      await this.redis.setex(key, STATE_TTL_SECONDS, next);
      const transition: GeofenceTransition = {
        tripId: latest.tripId,
        stopId: stop.stopId,
        stopName: stop.name,
        event: next as GeofenceTransition['event'],
        ts: latest.deviceTs,
      };
      await this.prisma.geofenceEvent.create({
        data: { tripId: latest.tripId, stopId: stop.stopId, event: transition.event },
      });
      // When the bus leaves a stop, anyone still EXPECTED there didn't board.
      if (transition.event === 'DEPARTED') {
        transition.notBoarded = await this.markNotBoarded(latest.tripId, stop.stopId);
      }
      this.logger.log(`geofence ${latest.tripId}/${stop.name}: ${current} -> ${next}`);
      transitions.push(transition);
    }
    return transitions;
  }

  /** Flip riders still EXPECTED at a departed stop to NOT_BOARDED; returns them. */
  private async markNotBoarded(tripId: string, stopId: string) {
    const riders = await this.prisma.tripRider.findMany({
      where: { tripId, stopId, boardStatus: 'EXPECTED' },
      include: { student: { select: { name: true } } },
    });
    if (riders.length === 0) return [];

    await this.prisma.tripRider.updateMany({
      where: { tripId, stopId, boardStatus: 'EXPECTED' },
      data: { boardStatus: 'NOT_BOARDED' },
    });
    riders.forEach((r) => this.logger.warn(`NOT_BOARDED: ${r.student.name} (trip ${tripId})`));
    return riders.map((r) => ({ studentId: r.studentId, studentName: r.student.name }));
  }

  /** Forward-only state machine with hysteresis on the enter/exit thresholds. */
  private nextState(current: GeofenceState, dist: number, radius: number): GeofenceState {
    const atStop = dist <= radius;
    const approaching = dist <= radius * APPROACH_FACTOR;
    const cleared = dist > radius * DEPART_FACTOR;

    switch (current) {
      case 'ABSENT':
        if (atStop) return 'AT_STOP';
        if (approaching) return 'APPROACHING';
        return 'ABSENT';
      case 'APPROACHING':
        if (atStop) return 'AT_STOP';
        return 'APPROACHING';
      case 'AT_STOP':
        if (cleared) return 'DEPARTED';
        return 'AT_STOP';
      default:
        return current;
    }
  }
}
