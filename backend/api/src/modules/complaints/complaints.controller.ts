import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ComplaintsService } from './complaints.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { IsString, IsOptional } from 'class-validator';
import type { ActiveMembership } from '@saarthi/types';

class CreateComplaintDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() tripId?: string;
  @IsString() category!: string;
  @IsOptional() @IsString() description?: string;
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
  listAll(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.complaintsService.listByTenant(tenantId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complaintsService.findById(id);
  }
}
