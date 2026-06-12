import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import type { LocationPingDto } from './dto/location-ping.dto';

/** Snapshot of a vehicle's most recent known position, cached in Redis. */
export interface LatestPosition {
  tripId: string;
  tenantId: string;
  vehicleId: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy: number;
  deviceTs: string;
  serverTs: string;
  sequence: number;
}

export interface IngestResult {
  tripId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  latest: LatestPosition | null;
}

interface TripMeta {
  vehicleId: string | null;
  tenantId: string;
}

// Pings arriving with a device clock more than this far in the future are
// treated as clock skew and clamped to server time.
const FUTURE_SKEW_MS = 2 * 60 * 1000;
// How long a cached latest position stays warm with no new pings.
const LATEST_TTL_SECONDS = 300;
const TRIP_META_TTL_SECONDS = 3600;

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Redis key for a vehicle's latest position (falls back to trip-keyed when no vehicle). */
  private latestKey(meta: TripMeta, tripId: string): string {
    return meta.vehicleId ? `vehicle:${meta.vehicleId}:latest` : `trip:${tripId}:latest`;
  }

  /** Resolve (and cache) a trip's vehicle + tenant so ingest doesn't hit Postgres per ping. */
  private async getTripMeta(tripId: string): Promise<TripMeta | null> {
    const cached = await this.redis.get(`trip:${tripId}:meta`);
    if (cached) return JSON.parse(cached) as TripMeta;

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { vehicleId: true, tenantId: true },
    });
    if (!trip) return null;

    const meta: TripMeta = { vehicleId: trip.vehicleId, tenantId: trip.tenantId };
    await this.redis.setex(`trip:${tripId}:meta`, TRIP_META_TTL_SECONDS, JSON.stringify(meta));
    return meta;
  }

  /**
   * deviceTs reconciliation + in-batch dedup.
   * - sorts by sequence; collapses duplicate sequences (keeps the last seen)
   * - drops pings with an unparseable timestamp
   * - clamps wildly-future device clocks to server time
   * The (tripId, sequence) unique index handles dedup against already-stored pings.
   */
  private reconcile(
    pings: LocationPingDto[],
    tenantId: string,
    now: Date,
  ): { kept: Omit<LatestPosition, 'vehicleId'>[]; rejected: number } {
    const bySeq = new Map<number, LocationPingDto>();
    for (const p of pings) bySeq.set(p.sequence, p); // later wins
    const ordered = [...bySeq.values()].sort((a, b) => a.sequence - b.sequence);

    const kept: Omit<LatestPosition, 'vehicleId'>[] = [];
    let rejected = 0;
    for (const p of ordered) {
      const parsed = new Date(p.deviceTs);
      if (Number.isNaN(parsed.getTime())) {
        rejected++;
        continue;
      }
      // Clamp clock skew rather than discard the position outright.
      const deviceTs = parsed.getTime() > now.getTime() + FUTURE_SKEW_MS ? now : parsed;
      kept.push({
        tripId: p.tripId,
        tenantId,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        speed: p.speed ?? null,
        deviceTs: deviceTs.toISOString(),
        serverTs: now.toISOString(),
        sequence: p.sequence,
      });
    }
    return { kept, rejected };
  }

  /** Tenant that owns a trip — used to scope socket room joins. Null if unknown. */
  async getTripTenant(tripId: string): Promise<string | null> {
    const meta = await this.getTripMeta(tripId);
    return meta?.tenantId ?? null;
  }

  /** Ingest a batch of pings for a single trip. */
  async ingestBatch(tripId: string, tenantId: string, pings: LocationPingDto[]): Promise<IngestResult> {
    const now = new Date();
    const meta = await this.getTripMeta(tripId);
    const resolvedTenant = meta?.tenantId ?? tenantId;

    const { kept, rejected } = this.reconcile(pings, resolvedTenant, now);
    if (kept.length === 0) {
      return { tripId, accepted: 0, duplicates: 0, rejected, latest: null };
    }

    // Dedup against already-stored pings via the (tripId, sequence) unique index.
    const created = await this.prisma.locationPing.createMany({
      data: kept.map((k) => ({
        tripId,
        tenantId: resolvedTenant,
        lat: k.lat,
        lng: k.lng,
        accuracy: k.accuracy,
        speed: k.speed,
        deviceTs: new Date(k.deviceTs),
        serverTs: new Date(k.serverTs),
        sequence: k.sequence,
      })),
      skipDuplicates: true,
    });
    const accepted = created.count;
    const duplicates = kept.length - accepted;

    // Advance the latest-position cache only if this batch is genuinely newer.
    const newest = kept[kept.length - 1];
    const candidate: LatestPosition = { ...newest, vehicleId: meta?.vehicleId ?? null };
    const advanced = await this.updateLatestIfNewer(
      tripId,
      meta ?? { vehicleId: null, tenantId: resolvedTenant },
      candidate,
    );

    // Only surface a position to broadcast when it actually moved the trip
    // forward (skips full-duplicate replays and out-of-order flushes).
    return { tripId, accepted, duplicates, rejected, latest: advanced ? candidate : null };
  }

  /** Convenience single-ping ingest (used by the Socket.IO driver:ping path). */
  ingestOne(dto: LocationPingDto, tenantId: string): Promise<IngestResult> {
    return this.ingestBatch(dto.tripId, tenantId, [dto]);
  }

  /** Returns true if the cache advanced to the candidate (i.e. it was newer). */
  private async updateLatestIfNewer(tripId: string, meta: TripMeta, candidate: LatestPosition): Promise<boolean> {
    const key = this.latestKey(meta, tripId);
    const existing = await this.redis.get(key);
    if (existing) {
      const prev = JSON.parse(existing) as LatestPosition;
      if (prev.sequence >= candidate.sequence) return false; // out-of-order arrival — ignore
    }
    await this.redis.setex(key, LATEST_TTL_SECONDS, JSON.stringify(candidate));
    return true;
  }

  /** Latest known position for a trip — Redis-first, DB fallback. */
  async getLatest(tripId: string): Promise<LatestPosition | null> {
    const meta = await this.getTripMeta(tripId);
    if (meta) {
      const cached = await this.redis.get(this.latestKey(meta, tripId));
      if (cached) return JSON.parse(cached) as LatestPosition;
    }

    const ping = await this.prisma.locationPing.findFirst({
      where: { tripId },
      orderBy: { sequence: 'desc' },
    });
    if (!ping) return null;
    return {
      tripId: ping.tripId,
      tenantId: ping.tenantId,
      vehicleId: meta?.vehicleId ?? null,
      lat: ping.lat,
      lng: ping.lng,
      speed: ping.speed,
      accuracy: ping.accuracy,
      deviceTs: ping.deviceTs.toISOString(),
      serverTs: ping.serverTs.toISOString(),
      sequence: ping.sequence,
    };
  }

  /**
   * Snapshot of every currently-active trip in a tenant + its latest position,
   * for the admin fleet map's initial load (live deltas arrive via the socket).
   */
  async getFleet(tenantId: string) {
    const trips = await this.prisma.trip.findMany({
      where: { tenantId, status: { in: ['STARTED', 'IN_PROGRESS'] } },
      include: { route: true, vehicle: true },
    });
    return Promise.all(
      trips.map(async (trip) => ({
        tripId: trip.id,
        status: trip.status,
        routeName: trip.route.name,
        direction: trip.direction,
        vehicleReg: trip.vehicle?.regNumber ?? null,
        latest: await this.getLatest(trip.id),
      })),
    );
  }

  /** Full ordered ping history for a trip. */
  getHistory(tripId: string) {
    return this.prisma.locationPing.findMany({
      where: { tripId },
      orderBy: { sequence: 'asc' },
    });
  }

  /**
   * Downsampled path for ride replay — evenly samples to <= maxPoints,
   * always keeping the first and last fix so the polyline endpoints are exact.
   */
  async getReplay(tripId: string, maxPoints = 200) {
    const pings = await this.prisma.locationPing.findMany({
      where: { tripId },
      orderBy: { sequence: 'asc' },
      select: { lat: true, lng: true, speed: true, deviceTs: true, sequence: true },
    });
    if (pings.length <= maxPoints) return pings;

    const step = (pings.length - 1) / (maxPoints - 1);
    const sampled = [];
    for (let i = 0; i < maxPoints; i++) {
      sampled.push(pings[Math.round(i * step)]);
    }
    return sampled;
  }
}
