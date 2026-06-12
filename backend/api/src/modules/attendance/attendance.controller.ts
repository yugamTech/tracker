import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AttendanceService } from './attendance.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import type { ActiveMembership } from '@saarthi/types';

class MarkAttendanceDto {
  @IsString() tripId!: string;
  @IsString() studentId!: string;
  @IsEnum(['BOARDED', 'ALIGHTED']) type!: 'BOARDED' | 'ALIGHTED';
  @IsOptional() @IsString() photoUrl?: string;
}

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  mark(
    @Body() dto: MarkAttendanceDto,
    @TenantId() tenantId: string,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    return this.attendanceService.mark({ ...dto, tenantId, markedBy: membership.membershipId });
  }

  @Get('trip/:tripId')
  getTripAttendance(@Param('tripId') tripId: string) {
    return this.attendanceService.getTripAttendance(tripId);
  }
}
