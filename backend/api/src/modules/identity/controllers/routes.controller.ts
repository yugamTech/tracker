import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoutesService } from '../routes.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Role } from '@yaanam/types';

class CreateRouteDto {
  @IsString() name!: string;
}

class UpdateRouteDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE';
  // The designated bus for this route. A non-empty id sets it; an empty string
  // clears it. Validated tenant-scoped in the service.
  @IsOptional() @IsString() vehicleId?: string;
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

  /**
   * Emergency "who's on which bus/route" directory. Declared BEFORE `:id` so the
   * literal path isn't captured as a route id. Admin/manager only — it exposes
   * staff phone numbers.
   */
  @Get('emergency')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  emergencyDirectory(@TenantId() tenantId: string) {
    return this.routesService.emergencyDirectory(tenantId);
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.routesService.findById(id, tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  create(@TenantId() tenantId: string, @Body() dto: CreateRouteDto) {
    return this.routesService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, tenantId, dto);
  }

  /** Soft-delete: flips the route to INACTIVE (never a hard delete). Tenant-scoped. */
  @Post(':id/deactivate')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.routesService.deactivate(id, tenantId);
  }

  /** Reactivate a soft-deactivated route (status → ACTIVE). Tenant-scoped. */
  @Post(':id/reactivate')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  reactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.routesService.reactivate(id, tenantId);
  }

  /**
   * HARD-delete — permanent, ONLY when no trip ever referenced this route. Blocks
   * with a clear message otherwise ("has trip history — deactivate instead").
   * Distinct from deactivate (reversible). Tenant-scoped.
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.routesService.hardDelete(id, tenantId);
  }

  @Post(':id/stops')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  addStop(@TenantId() tenantId: string, @Param('id') routeId: string, @Body() dto: AddStopDto) {
    return this.routesService.addStop(tenantId, { routeId, ...dto });
  }

  @Delete(':id/stops/:stopId')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  removeStop(@TenantId() tenantId: string, @Param('id') routeId: string, @Param('stopId') stopId: string) {
    return this.routesService.removeStop(routeId, tenantId, stopId);
  }
}
