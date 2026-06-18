import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AttendanceService } from './attendance.service';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import type { ActiveMembership } from '@saarthi/types';

class MarkAttendanceDto {
  @IsString() tripId!: string;
  @IsString() studentId!: string;
  // BOARDED / ALIGHTED are recorded as AttendanceEvents; NOT_BOARDED only flips
  // the rider's boardStatus (there is no NOT_BOARDED attendance event type).
  @IsEnum(['BOARDED', 'ALIGHTED', 'NOT_BOARDED'])
  type!: 'BOARDED' | 'ALIGHTED' | 'NOT_BOARDED';
  @IsOptional() @IsString() photoUrl?: string;
}

class UploadPhotoDto {
  @IsString() filename!: string;
  @IsOptional() @IsString() contentType?: string;
  @IsOptional() @IsString() base64?: string;
}

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly gateway: TrackingGateway,
  ) {}

  @Post()
  async mark(
    @Body() dto: MarkAttendanceDto,
    @TenantId() tenantId: string,
    @ActiveMembershipDec() membership: ActiveMembership,
  ) {
    const event = await this.attendanceService.mark({
      ...dto,
      tenantId,
      markedBy: membership.membershipId,
    });
    this.gateway.emitAttendance(dto.tripId, {
      tripId: dto.tripId,
      studentId: dto.studentId,
      studentName: event.student.name,
      tenantId,
      type: dto.type,
      ts: event.ts.toISOString(),
    });
    return event;
  }

  /** Driver roster grouped by stop, with board-status summary. */
  @Get('trip/:tripId/roster')
  roster(@Param('tripId') tripId: string) {
    return this.attendanceService.getRoster(tripId);
  }

  @Get('trip/:tripId')
  getTripAttendance(@Param('tripId') tripId: string) {
    return this.attendanceService.getTripAttendance(tripId);
  }

  /** Store an attendance photo locally and return its URL (no DO Spaces in Phase 3). */
  @Post('photo')
  uploadPhoto(@Body() dto: UploadPhotoDto) {
    return this.attendanceService.savePhoto(dto.filename, dto.contentType, dto.base64);
  }
}
