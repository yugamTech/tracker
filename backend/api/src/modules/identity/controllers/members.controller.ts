import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { MembersService, STAFF_ROLES } from '../members.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { Role } from '@yaanam/types';

class CreateMemberDto {
  @IsString() name!: string;
  @IsString() phone!: string;
  @IsIn(STAFF_ROLES) role!: Role;
  @IsOptional() @IsString() email?: string;
}

class UpdateMemberDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsIn(STAFF_ROLES) role?: Role;
}

// Staff management is admin-only: every endpoint here exposes or mutates staff
// records (incl. phone numbers), so the whole controller is gated to
// ADMIN / TRANSPORT_MANAGER. RolesGuard is a no-op without @Roles metadata, so
// the class-level guard only enforces where @Roles is present.
@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('role') role?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.membersService.list(tenantId, role, includeInactive === 'true');
  }

  @Get('parents')
  listParents(
    @TenantId() tenantId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.membersService.listParents(tenantId, includeInactive === 'true');
  }

  @Get(':id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.membersService.findById(id, tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateMemberDto) {
    return this.membersService.create({ tenantId, ...dto });
  }

  @Patch(':id')
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, tenantId, dto);
  }

  @Post(':id/deactivate')
  deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.membersService.deactivate(id, tenantId);
  }

  /** Reactivate a soft-deactivated staff member (status → ACTIVE). Tenant-scoped. */
  @Post(':id/reactivate')
  reactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.membersService.reactivate(id, tenantId);
  }

  /**
   * HARD-delete — permanent, ONLY when the staff member never drove/conducted a
   * trip that ran. Blocks with a clear message otherwise. Removes the membership
   * (and the global Person when fully orphaned). Distinct from deactivate
   * (reversible). Tenant-scoped.
   */
  @Delete(':id')
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.membersService.hardDelete(id, tenantId);
  }
}
