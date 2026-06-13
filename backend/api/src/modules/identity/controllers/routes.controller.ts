import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoutesService } from '../routes.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Role } from '@saarthi/types';

class CreateRouteDto {
  @IsString() name!: string;
  @IsString() direction!: 'PICKUP' | 'DROP';
}

class UpdateRouteDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE';
}

class AddStopDto {
  @IsString() stopId!: string;
  @IsNumber() sequence!: number;
}

@ApiTags('routes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.routesService.list(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routesService.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  create(@TenantId() tenantId: string, @Body() dto: CreateRouteDto) {
    return this.routesService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Post(':id/stops')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  addStop(@Param('id') routeId: string, @Body() dto: AddStopDto) {
    return this.routesService.addStop({ routeId, ...dto });
  }

  @Delete(':id/stops/:stopId')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  removeStop(@Param('id') routeId: string, @Param('stopId') stopId: string) {
    return this.routesService.removeStop(routeId, stopId);
  }
}
