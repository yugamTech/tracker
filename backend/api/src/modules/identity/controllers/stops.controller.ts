import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { StopsService } from '../stops.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNumber, IsOptional } from 'class-validator';

class CreateStopDto {
  @IsString() name!: string;
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsNumber() geofenceRadius?: number;
}

class UpdateStopDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsNumber() geofenceRadius?: number;
}

@ApiTags('stops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.stopsService.list(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stopsService.findById(id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateStopDto) {
    return this.stopsService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStopDto) {
    return this.stopsService.update(id, dto);
  }
}
