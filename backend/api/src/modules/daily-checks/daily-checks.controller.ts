import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../common/decorators/person-id.decorator';
import { DailyChecksService } from './daily-checks.service';

class CreateDailyCheckDto {
  @IsString() vehicleId!: string;
  @IsOptional() @IsString() tripId?: string;
  @IsObject() items!: Record<string, boolean>;
  @IsOptional() @IsString() note?: string;
  /** Optional bus-condition photo URLs captured at check time (already uploaded). */
  @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
}

@ApiTags('daily-checks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('daily-checks')
export class DailyChecksController {
  constructor(private readonly service: DailyChecksService) {}

  @Post()
  create(
    @TenantId() tenantId: string,
    @PersonId() personId: string,
    @Body() dto: CreateDailyCheckDto,
  ) {
    return this.service.create({
      tenantId,
      submittedById: personId,
      vehicleId: dto.vehicleId,
      tripId: dto.tripId,
      items: dto.items,
      note: dto.note,
      photoUrls: dto.photoUrls,
    });
  }

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('date') date?: string,
  ) {
    return this.service.list(tenantId, { vehicleId, date: date ? new Date(date) : undefined });
  }

  /**
   * Parent-facing bus-condition photos for the vehicle on their child's trip.
   * Guardian + tenant-scoped and clamped to the last 30 days in the service; a
   * request for another family's/foreign-tenant trip 404s.
   */
  @Get('trip/:tripId/bus-photos')
  busPhotos(
    @TenantId() tenantId: string,
    @PersonId() personId: string,
    @Param('tripId') tripId: string,
  ) {
    return this.service.busPhotosForGuardian(tenantId, personId, tripId);
  }
}
