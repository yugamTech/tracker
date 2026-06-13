import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MembersService, STAFF_ROLES } from '../members.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import type { Role } from '@saarthi/types';

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

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query('role') role?: string) {
    return this.membersService.list(tenantId, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membersService.findById(id);
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
