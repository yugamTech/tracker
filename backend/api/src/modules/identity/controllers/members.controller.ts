import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { MembersService, STAFF_ROLES } from '../members.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { Role } from '@saarthi/types';

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
  list(@TenantId() tenantId: string, @Query('role') role?: string) {
    return this.membersService.list(tenantId, role);
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
}
