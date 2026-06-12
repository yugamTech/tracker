import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TripsService } from './trips.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

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
}
