import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { StopsService } from '../stops.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Role } from '@yaanam/types';

// Latitude is bounded to [-90, 90] and longitude to [-180, 180]; a value outside
// that range is a typo (swapped lat/lng, extra digit) that would put a stop in the
// ocean and break geofencing — reject it at the edge with a clear message.
class CreateStopDto {
  @IsString() name!: string;
  @IsNumber() @Min(-90, { message: 'lat must be between -90 and 90' }) @Max(90, { message: 'lat must be between -90 and 90' }) lat!: number;
  @IsNumber() @Min(-180, { message: 'lng must be between -180 and 180' }) @Max(180, { message: 'lng must be between -180 and 180' }) lng!: number;
  @IsOptional() @IsNumber() @Min(0, { message: 'geofenceRadius must be ≥ 0' }) geofenceRadius?: number;
}

class UpdateStopDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() @Min(-90, { message: 'lat must be between -90 and 90' }) @Max(90, { message: 'lat must be between -90 and 90' }) lat?: number;
  @IsOptional() @IsNumber() @Min(-180, { message: 'lng must be between -180 and 180' }) @Max(180, { message: 'lng must be between -180 and 180' }) lng?: number;
  @IsOptional() @IsNumber() @Min(0, { message: 'geofenceRadius must be ≥ 0' }) geofenceRadius?: number;
}

@ApiTags('stops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.stopsService.list(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.stopsService.findById(id, tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  create(@TenantId() tenantId: string, @Body() dto: CreateStopDto) {
    return this.stopsService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateStopDto) {
    return this.stopsService.update(id, tenantId, dto);
  }
}
