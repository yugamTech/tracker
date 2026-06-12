import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
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
    if (result.latest) this.gateway.broadcastLocation(result.latest);
    return result;
  }

  /** Batch ping ingest — offline-buffer flush or the driver-ping simulator. */
  @Post('ping/batch')
  async pingBatch(@Body() dto: LocationPingBatchDto, @TenantId() tenantId: string) {
    const tripId = dto.pings[0].tripId;
    const result = await this.location.ingestBatch(tripId, tenantId, dto.pings);
    if (result.latest) this.gateway.broadcastLocation(result.latest);
    return result;
  }

  /** Latest known position for a trip (parent live map initial load). */
  @Get(':tripId/latest')
  latest(@Param('tripId') tripId: string) {
    return this.location.getLatest(tripId);
  }

  /** Full ordered ping history for a trip. */
  @Get('trips/:tripId/history')
  history(@Param('tripId') tripId: string) {
    return this.location.getHistory(tripId);
  }

  /** Downsampled path for ride replay. */
  @Get('trips/:tripId/replay')
  replay(@Param('tripId') tripId: string) {
    return this.location.getReplay(tripId);
  }
}
