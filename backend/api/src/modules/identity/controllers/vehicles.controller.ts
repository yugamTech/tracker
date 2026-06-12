import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { VehiclesService } from '../vehicles.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNumber, IsOptional } from 'class-validator';

class CreateVehicleDto {
  @IsString() regNumber!: string;
  @IsNumber() capacity!: number;
  @IsOptional() @IsString() type?: string;
}

class UpdateVehicleDto {
  @IsOptional() @IsString() regNumber?: string;
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.vehiclesService.list(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findById(id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }
}
