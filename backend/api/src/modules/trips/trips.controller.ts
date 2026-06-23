import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsString, IsOptional, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TripsService } from './trips.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ActiveMembershipDec } from '../../common/decorators/active-membership.decorator';
import { Role, Direction, TripStatus } from '@yaanam/types';
import type { ActiveMembership } from '@yaanam/types';

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

class CompleteTripDto {
  /** Mandatory only when completing before the final stop (early completion). */
  @IsOptional() @IsString() reason?: string;
  /** 1-based sequence of the last stop serviced; defaults to "final stop" when omitted. */
  @IsOptional() @IsInt() @Min(1) stoppedAtSeq?: number;
}

/** Abort a live trip — reason mandatory (PRD-02a §4). */
class AbortTripDto {
  @IsString() reason!: string;
}

/** Admin force-complete a trip the driver forgot to close — reason mandatory (PRD-02a §4). */
class ForceCompleteTripDto {
  @IsString() reason!: string;
}

/** Admin acknowledge of an overdue / auto-aborted lifecycle alarm — optional note. */
class AcknowledgeTripDto {
  @IsOptional() @IsString() note?: string;
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

  /** Open lifecycle-alarm feed (PRD-02a §6): started-not-completed trips — overdue
   *  (still live) + abandoned (auto-aborted) — that admins must act on, actor-scoped.
   *  Declared before the `:id` route so the path isn't captured as a trip id. */
  @Get('lifecycle-alarms')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  lifecycleAlarms(@ActiveMembershipDec() actor: ActiveMembership) {
    return this.tripsService.listLifecycleAlarms(actor);
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

  /** List trip-completion (early-end) exceptions for the admin alarm panel (default: open
   *  only). Declared before the `:id` route so the path isn't captured as a trip id. */
  @Get('completion-exceptions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  listCompletionExceptions(@TenantId() tenantId: string, @Query('resolved') resolved?: string) {
    const filter =
      resolved === 'true' ? { resolved: true } : resolved === 'all' ? {} : { resolved: false };
    return this.tripsService.listCompletionExceptions(tenantId, filter);
  }

  /** Driver ride history + efficiency summary, scoped to the caller. Declared
   *  before the `:id` route so "history" isn't captured as a trip id. */
  @Get('history')
  history(@ActiveMembershipDec() actor: ActiveMembership) {
    return this.tripsService.getDriverHistory(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ActiveMembershipDec() actor: ActiveMembership) {
    return this.tripsService.findById(id, actor);
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

  /** Resolve a trip-completion exception — records resolver + timestamp. Admin only. */
  @Post('completion-exceptions/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  resolveCompletionException(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @ActiveMembershipDec() actor: ActiveMembership,
  ) {
    return this.tripsService.resolveCompletionException(id, tenantId, actor.personId);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Body() dto: StartTripDto) {
    return this.tripsService.start(id, { reason: dto.reason });
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteTripDto) {
    return this.tripsService.complete(id, { reason: dto.reason, stoppedAtSeq: dto.stoppedAtSeq });
  }

  /** Cancel a SCHEDULED trip (before departure). Admin only, tenant-scoped. */
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  cancel(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.tripsService.cancel(id, tenantId);
  }

  /**
   * Abort a live trip with a mandatory reason (PRD-02a §4). Available to the trip's
   * own driver (the "end a stale trip" path) and to admins (force-abort) — both are
   * tenant-scoped in the service and audited with the acting person. The actor's
   * reason + identity are recorded; affected parents + driver are notified.
   */
  @Post(':id/abort')
  abort(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AbortTripDto,
    @ActiveMembershipDec() actor: ActiveMembership,
  ) {
    return this.tripsService.abort(id, { reason: dto.reason, actorId: actor.personId, tenantId });
  }

  /** Admin force-complete a trip the driver ran but forgot to close (PRD-02a §4). */
  @Post(':id/force-complete')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  forceComplete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ForceCompleteTripDto,
    @ActiveMembershipDec() actor: ActiveMembership,
  ) {
    return this.tripsService.forceComplete(id, tenantId, actor.personId, dto.reason);
  }

  /** Acknowledge an overdue / auto-aborted lifecycle alarm — removes it from the
   *  open feed with an audit note (PRD-02a §5/§6). Admin only. */
  @Post(':id/acknowledge')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.TRANSPORT_MANAGER)
  acknowledge(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AcknowledgeTripDto,
    @ActiveMembershipDec() actor: ActiveMembership,
  ) {
    return this.tripsService.acknowledgeLifecycle(id, tenantId, actor.personId, dto.note);
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
