import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TripsService } from './trips.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { Role, Direction, TripStatus } from '@saarthi/types';
import type { ActiveMembership } from '@saarthi/types';

class CancelPickupDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() reason?: string;
}

class CreateTripDto {
  @IsString() routeId!: string;
  @IsString() vehicleId!: string;
  @IsString() driverId!: string;
  @IsOptional() @IsString() conductorId?: string;
  @IsDateString() date!: string;
  @IsEnum(Direction) direction!: Direction;
  @IsOptional() @IsDateString() scheduledStart?: string;
}

/** Edit a SCHEDULED trip — every field optional; only the supplied ones change. */
class UpdateTripDto {
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() driverId?: string;
  @IsOptional() @IsString() conductorId?: string;
  @IsOptional() @IsEnum(Direction) direction?: Direction;
  @IsOptional() @IsDateString() scheduledStart?: string;
}

class StartTripDto {
  /** Mandatory only when the trip starts off-protocol (no daily check / outside window). */
  @IsOptional() @IsString() reason?: string;
}

/** Parse a `YYYY-MM-DD` calendar-day string into a local-time midnight Date. */
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * List trips, optionally filtered by a single calendar day (`?date=YYYY-MM-DD`),
   * `?status=`, `?route=`, and `?driver=`. Filters are combinable and always
   * AND-ed onto the caller's role scope, so they can only ever narrow the result.
   */
  @Get()
  list(
    @ActiveMembershipDec() actor: ActiveMembership,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('route') routeId?: string,
    @Query('driver') driverId?: string,
  ) {
    // Ignore an unknown status rather than passing garbage to Prisma (→ 500).
    const tripStatus =
      status && (Object.values(TripStatus) as string[]).includes(status)
        ? (status as TripStatus)
        : undefined;
    return this.tripsService.list(actor, {
      date: date ? parseDateOnly(date) : undefined,
      status: tripStatus,
      routeId: routeId || undefined,
      driverId: driverId || undefined,
    });
  }

  @Get('today')
  today(@ActiveMembershipDec() actor: ActiveMembership) {
    return this.tripsService.getTodayTrips(actor);
  }

  /** Calendar-dot feed: the ISO `YYYY-MM-DD` days (scoped to the actor) that have
   *  at least one trip within [from, to]. Cheap — returns dates only, no payloads.
   *  Declared before the `:id` route so "dates" isn't captured as a trip id. */
  @Get('dates')
  dates(
    @ActiveMembershipDec() actor: ActiveMembership,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tripsService.tripDates(actor, {
      from: from ? parseDateOnly(from) : undefined,
      to: to ? parseDateOnly(to) : undefined,
    });
  }

  /** Never-started anomaly feed: trips still SCHEDULED >12h past their planned start
   *  (computed on read, tenant + actor scoped). Admin alarm panel. Declared before
   *  the `:id` route so "overdue" isn't captured as a trip id. */
  @Get('overdue')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  overdue(@ActiveMembershipDec() actor: ActiveMembership) {
    return this.tripsService.listOverdueScheduled(actor);
  }

  /** List trip-start exceptions for the admin alarm panel (default: open only).
   *  Declared before the `:id` route so "exceptions" isn't captured as a trip id. */
  @Get('exceptions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  listExceptions(@TenantId() tenantId: string, @Query('resolved') resolved?: string) {
    const filter =
      resolved === 'true' ? { resolved: true } : resolved === 'all' ? {} : { resolved: false };
    return this.tripsService.listStartExceptions(tenantId, filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  /**
   * Edit a SCHEDULED trip's plan (driver/vehicle/conductor/scheduledStart/
   * direction/route). Rejected once the trip has left SCHEDULED. Admin only,
   * tenant-scoped. Rebuilds the roster in the service if the route changes.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.editScheduled(id, tenantId, {
      routeId: dto.routeId,
      vehicleId: dto.vehicleId,
      driverId: dto.driverId,
      conductorId: dto.conductorId,
      direction: dto.direction,
      scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
    });
  }

  /** Schedule a trip + auto-build its roster (PRD-02 FR-01/FR-02). Admin only. */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  create(@TenantId() tenantId: string, @Body() dto: CreateTripDto) {
    return this.tripsService.create({
      tenantId,
      routeId: dto.routeId,
      vehicleId: dto.vehicleId,
      driverId: dto.driverId,
      conductorId: dto.conductorId,
      date: new Date(dto.date),
      direction: dto.direction,
      scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
    });
  }

  /** Resolve a trip-start exception — records resolver + timestamp. Admin only. */
  @Post('exceptions/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  resolveException(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @ActiveMembershipDec() actor: ActiveMembership,
  ) {
    return this.tripsService.resolveStartException(id, tenantId, actor.personId);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Body() dto: StartTripDto) {
    return this.tripsService.start(id, { reason: dto.reason });
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.tripsService.complete(id);
  }

  /** Cancel a SCHEDULED trip (before departure). Admin only, tenant-scoped. */
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  cancel(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tripsService.cancel(id, tenantId);
  }

  @Post(':id/abort')
  abort(@Param('id') id: string) {
    return this.tripsService.abort(id);
  }

  /** DEV ONLY (OTP bypass mode): reset a trip for a clean demo replay. */
  @Post(':id/reset')
  reset(@Param('id') id: string) {
    if (this.config.get<string>('OTP_BYPASS_MODE') !== 'true') {
      throw new ForbiddenException('Trip reset is only available in dev (OTP_BYPASS_MODE)');
    }
    return this.tripsService.resetForDemo(id);
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
