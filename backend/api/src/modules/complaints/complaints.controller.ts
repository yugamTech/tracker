import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplaintsService } from './complaints.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { IsString, IsOptional } from 'class-validator';
import { Role } from '@yaanam/types';
import type { ActiveMembership } from '@yaanam/types';

class CreateComplaintDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() tripId?: string;
  @IsString() category!: string;
  @IsOptional() @IsString() description?: string;
}

class UpdateComplaintStatusDto {
  @IsString() status!: string;
  @IsOptional() @IsString() note?: string;
}

@ApiTags('complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  create(
    @Body() dto: CreateComplaintDto,
    @TenantId() tenantId: string,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.complaintsService.create({ ...dto, tenantId, raisedBy: membership.personId });
  }

  @Get()
  list(
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.complaintsService.listByRaiser(membership.personId);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  listAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('routeId') routeId?: string,
    @Query('driverId') driverId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.complaintsService.listByTenant(tenantId, { status, category, routeId, driverId, dateFrom, dateTo });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.complaintsService.findById(id, tenantId);
  }

  // Status changes (incl. closing/resolving a complaint) are an admin action —
  // a parent can CREATE and VIEW their own complaints, but must never be able to
  // mutate a complaint's status. Gated to ADMIN / TRANSPORT_MANAGER, mirroring
  // `listAll` above (RolesGuard is a no-op on the other methods without @Roles).
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintStatusDto,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.complaintsService.updateStatus(id, dto.status, membership.personId, dto.note);
  }
}
