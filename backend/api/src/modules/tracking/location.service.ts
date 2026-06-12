import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';
import type { LocationPingDto } from './dto/location-ping.dto';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async ingest(dto: LocationPingDto, tenantId: string) {
    // Persist to DB
    const ping = await this.prisma.locationPing.create({
      data: {
        tripId: dto.tripId,
        tenantId,
        lat: dto.lat,
        lng: dto.lng,
        accuracy: dto.accuracy,
        speed: dto.speed,
        deviceTs: new Date(dto.deviceTs),
        sequence: dto.sequence,
      },
    });

    // Cache latest position in Redis for fast reads
    await this.redis.setex(
      `trip:${dto.tripId}:location`,
      300, // expire after 5 minutes of inactivity
      JSON.stringify({ lat: dto.lat, lng: dto.lng, ts: dto.deviceTs }),
    );

    return ping;
  }

  async getLatestLocation(tripId: string) {
    const cached = await this.redis.get(`trip:${tripId}:location`);
    if (cached) return JSON.parse(cached) as { lat: number; lng: number; ts: string };

    // Fallback to DB
    return this.prisma.locationPing.findFirst({
      where: { tripId },
      orderBy: { deviceTs: 'desc' },
    });
  }

  getHistory(tripId: string) {
    return this.prisma.locationPing.findMany({
      where: { tripId },
      orderBy: { sequence: 'asc' },
    });
  }
}
