import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PersonId } from '../../common/decorators/person-id.decorator';
import { DailyChecksService } from './daily-checks.service';

class CreateDailyCheckDto {
  @IsString() vehicleId!: string;
  @IsOptional() @IsString() tripId?: string;
  @IsObject() items!: Record<string, boolean>;
  @IsOptional() @IsString() note?: string;
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
}
