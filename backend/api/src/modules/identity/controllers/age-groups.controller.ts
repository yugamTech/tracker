import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AgeGroupsService } from '../age-groups.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { Role } from '@yaanam/types';
import { SHIFT_TIME_PATTERN } from '../shift-time.util';

/** "HH:MM" (24-hour) human-readable error for the @Matches validators below. */
const HHMM_MESSAGE = 'must be a 24-hour time in HH:MM format (e.g. 08:00)';

class CreateAgeGroupDto {
  @IsString() @IsNotEmpty() name!: string;
  @Matches(SHIFT_TIME_PATTERN, { message: `pickupTime ${HHMM_MESSAGE}` }) pickupTime!: string;
  @Matches(SHIFT_TIME_PATTERN, { message: `dropTime ${HHMM_MESSAGE}` }) dropTime!: string;
  @IsOptional() @IsString() routeId?: string;
}

/** Edit a shift — every field optional; only the supplied ones change. */
class UpdateAgeGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @Matches(SHIFT_TIME_PATTERN, { message: `pickupTime ${HHMM_MESSAGE}` }) pickupTime?: string;
  @IsOptional() @Matches(SHIFT_TIME_PATTERN, { message: `dropTime ${HHMM_MESSAGE}` }) dropTime?: string;
  // A non-empty id (re)pins the route; an empty string clears the pin.
  @IsOptional() @IsString() routeId?: string;
}

/**
 * Shifts (AgeGroups) CRUD. List is open to any tenant member; create/update/delete
 * are admin/manager only. Tenant-scoping is enforced in the service.
 */
@ApiTags('age-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('age-groups')
export class AgeGroupsController {
  constructor(private readonly ageGroupsService: AgeGroupsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.ageGroupsService.list(tenantId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  create(@TenantId() tenantId: string, @Body() dto: CreateAgeGroupDto) {
    return this.ageGroupsService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateAgeGroupDto) {
    return this.ageGroupsService.update(id, tenantId, dto);
  }

  /** Hard-delete a shift — refuses with 409 while any student still belongs to it. */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ageGroupsService.delete(id, tenantId);
  }
}
