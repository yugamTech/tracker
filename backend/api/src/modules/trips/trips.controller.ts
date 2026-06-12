import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TripsService } from './trips.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import type { ActiveMembership } from '@saarthi/types';

class CancelPickupDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.tripsService.list(tenantId);
  }

  @Get('today')
  today(@TenantId() tenantId: string) {
    return this.tripsService.getTodayTrips(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.tripsService.start(id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.tripsService.complete(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tripsService.cancel(id);
  }

  @Post(':id/abort')
  abort(@Param('id') id: string) {
    return this.tripsService.abort(id);
  }

  @Post(':id/cancel-pickup')
  cancelPickup(
    @Param('id') id: string,
    @Body() dto: CancelPickupDto,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.tripsService.cancelPickup(id, dto.studentId, membership.membershipId, dto.reason);
  }
}
