import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AgeGroupsService } from '../age-groups.service';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { IsString, IsOptional } from 'class-validator';

class CreateAgeGroupDto {
  @IsString() name!: string;
  @IsString() pickupTime!: string;
  @IsString() dropTime!: string;
  @IsOptional() @IsString() routeId?: string;
}

@ApiTags('age-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('age-groups')
export class AgeGroupsController {
  constructor(private readonly ageGroupsService: AgeGroupsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.ageGroupsService.list(tenantId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateAgeGroupDto) {
    return this.ageGroupsService.create({ tenantId, ...dto });
  }
}
