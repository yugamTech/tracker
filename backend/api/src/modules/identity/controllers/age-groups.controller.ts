import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AgeGroupsService } from '../age-groups.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsOptional } from 'class-validator';
import { Role } from '@saarthi/types';

class CreateAgeGroupDto {
  @IsString() name!: string;
  @IsString() pickupTime!: string;
  @IsString() dropTime!: string;
  @IsOptional() @IsString() routeId?: string;
}

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
}
