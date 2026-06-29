import { Controller, Post, Get, Body, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { LocationService } from './location.service';
import { LocationPingDto, LocationPingBatchDto } from './dto/location-ping.dto';
import { TrackingGateway } from './tracking.gateway';

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly location: LocationService,
    private readonly gateway: TrackingGateway,
  ) {}

  /** Single ping ingest (REST). Fans out to subscribers like the socket path. */
  @Post('ping')
  async ping(@Body() dto: LocationPingDto, @TenantId() tenantId: string) {
    const result = await this.location.ingestOne(dto, tenantId);
    await this.gateway.processIngest(result);
    return this.summary(result);
  }

  /** Batch ping ingest — offline-buffer flush or the driver-ping simulator. */
  @Post('ping/batch')
  async pingBatch(@Body() dto: LocationPingBatchDto, @TenantId() tenantId: string) {
    const tripId = dto.pings[0].tripId;
    const result = await this.location.ingestBatch(tripId, tenantId, dto.pings);
    await this.gateway.processIngest(result);
    return this.summary(result);
  }

  private summary(r: { tripId: string; accepted: number; duplicates: number; rejected: number }) {
    return { tripId: r.tripId, accepted: r.accepted, duplicates: r.duplicates, rejected: r.rejected };
  }

  /** Active fleet snapshot for the tenant (admin fleet map initial load). */
  @Get('fleet')
  fleet(@TenantId() tenantId: string) {
    return this.location.getFleet(tenantId);
  }

  /** Latest known position for a trip (parent live map initial load). */
  @Get(':tripId/latest')
  async latest(@Param('tripId') tripId: string, @TenantId() tenantId: string) {
    await this.assertTripInTenant(tripId, tenantId);
    return this.location.getLatest(tripId);
  }

  /** Full ordered ping history for a trip. */
  @Get('trips/:tripId/history')
  async history(@Param('tripId') tripId: string, @TenantId() tenantId: string) {
    await this.assertTripInTenant(tripId, tenantId);
    return this.location.getHistory(tripId);
  }

  /** Downsampled path for ride replay. */
  @Get('trips/:tripId/replay')
  async replay(@Param('tripId') tripId: string, @TenantId() tenantId: string) {
    await this.assertTripInTenant(tripId, tenantId);
    return this.location.getReplay(tripId);
  }

  /**
   * Refuse to serve a trip's positions across tenants — the GPS read endpoints take
   * a bare tripId, so without this any authenticated user could pull any trip's live
   * location / breadcrumb trail. Mirrors the WebSocket room-join tenant guard. 404
   * (not 403) so an out-of-tenant id is indistinguishable from a non-existent one.
   */
  private async assertTripInTenant(tripId: string, tenantId: string): Promise<void> {
    const owner = await this.location.getTripTenant(tripId);
    if (owner !== tenantId) throw new NotFoundException(`Trip ${tripId} not found`);
  }
}
