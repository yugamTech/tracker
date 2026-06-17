import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';
import { TripStatus, RiderStatus, NotifCategory, Role, Direction } from '@saarthi/types';
import type { ActiveMembership } from '@saarthi/types';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { LocationService } from '../tracking/location.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Allowed status transitions for the trip lifecycle state machine. */
const TRANSITIONS: Record<string, TripStatus[]> = {
  [TripStatus.SCHEDULED]: [TripStatus.STARTED, TripStatus.CANCELLED],
  [TripStatus.STARTED]: [TripStatus.IN_PROGRESS, TripStatus.COMPLETED, TripStatus.ABORTED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.ABORTED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
  [TripStatus.ABORTED]: [],
};

/** Prisma date filter for [start-of-day, end-of-day] around the given instant. */
function dayRange(at: Date): { gte: Date; lte: Date } {
  const gte = new Date(at);
  gte.setHours(0, 0, 0, 0);
  const lte = new Date(at);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TrackingGateway,
    private readonly location: LocationService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Role-scoped trip filter (PRD-01 FR-12 / PRD-02 FR-10, NFR-05). A DRIVER sees
   * only trips they drive; a CONDUCTOR only trips they conduct; a PARENT only
   * trips carrying a student they guard; admins / transport managers keep the
   * tenant-wide view. The scope is derived from the JWT's active membership —
   * never from a client-supplied value — so no caller can see trips outside their
   * scope.
   */
  private scopeForActor(actor: ActiveMembership): Prisma.TripWhereInput {
    if (actor.role === Role.DRIVER) return { tenantId: actor.tenantId, driverId: actor.personId };
    if (actor.role === Role.CONDUCTOR) return { tenantId: actor.tenantId, conductorId: actor.personId };
    if (actor.role === Role.PARENT) {
      return {
        tenantId: actor.tenantId,
        riders: {
          some: { student: { guardianships: { some: { personId: actor.personId } } } },
        },
      };
    }
    return { tenantId: actor.tenantId };
  }

  list(actor: ActiveMembership, filters?: { date?: Date; status?: TripStatus }) {
    return this.prisma.trip.findMany({
      where: {
        ...this.scopeForActor(actor),
        ...(filters?.date && { date: dayRange(filters.date) }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
        conductor: true,
        riders: { include: { student: true, stop: true } },
      },
      // A single day reads as a morning→evening schedule; the unfiltered list
      // keeps newest-first.
      orderBy: { date: filters?.date ? 'asc' : 'desc' },
    });
  }

  /**
   * Calendar-dot feed (PRD-02): the distinct local calendar days within [from, to]
   * that carry at least one trip in the actor's scope. Selects `date` only — no
   * riders/route payloads — so a two-month calendar paints cheaply.
   */
  async tripDates(
    actor: ActiveMembership,
    range: { from?: Date; to?: Date } = {},
  ): Promise<string[]> {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (range.from) {
      const gte = new Date(range.from);
      gte.setHours(0, 0, 0, 0);
      dateFilter.gte = gte;
    }
    if (range.to) {
      const lte = new Date(range.to);
      lte.setHours(23, 59, 59, 999);
      dateFilter.lte = lte;
    }
    const trips = await this.prisma.trip.findMany({
      where: {
        ...this.scopeForActor(actor),
        ...(range.from || range.to ? { date: dateFilter } : {}),
      },
      select: { date: true },
    });
    const days = new Set<string>();
    for (const t of trips) {
      const d = t.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.add(key);
    }
    return [...days].sort();
  }

  findById(id: string) {
    return this.prisma.trip.findUniqueOrThrow({
      where: { id },
      include: {
        route: { include: { stops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } },
        vehicle: true,
        driver: true,
        conductor: true,
        riders: { include: { student: true, stop: true } },
        attendanceEvents: { orderBy: { ts: 'asc' } },
        geofenceEvents: { orderBy: { ts: 'asc' } },
      },
    });
  }

  getTodayTrips(actor: ActiveMembership) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.prisma.trip.findMany({
      where: { ...this.scopeForActor(actor), date: { gte: start, lte: end } },
      include: { route: true, vehicle: true, driver: true, conductor: true, riders: true },
      orderBy: { date: 'asc' },
    });
  }

  /** Validated status transition + trip:status fan-out. */
  private async transition(
    id: string,
    to: TripStatus,
    extra: { startedAt?: Date; completedAt?: Date } = {},
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    const allowed = TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot move trip from ${trip.status} to ${to}`);
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: to, ...extra },
    });

    this.gateway.emitTripStatus(id, trip.tenantId, {
      tripId: id,
      tenantId: trip.tenantId,
      status: to,
      ts: new Date().toISOString(),
    });
    return updated;
  }

  /**
   * Start a trip under the trip-start governance rule (2B). A trip starts CLEANLY
   * only if BOTH a DailyCheck exists for its vehicle today AND `now` is within
   * [scheduledStart − 1h, scheduledStart + 1h]. If either gate fails the driver must
   * supply a `reason` note — that starts the trip anyway, records a TripStartException,
   * and fires a fire-and-forget admin alarm notification. Without a note a blocked
   * start throws TRIP_START_BLOCKED so the driver UI can show why and prompt for one.
   */
  async start(id: string, opts: { reason?: string } = {}) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true, tenantId: true, vehicleId: true, scheduledStart: true, date: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    const now = new Date();
    const scheduledStart = trip.scheduledStart ?? trip.date;

    // Gate 1 — a daily vehicle check exists for this vehicle today.
    const dailyCheckDone = trip.vehicleId
      ? (await this.prisma.dailyCheck.count({
          where: { vehicleId: trip.vehicleId, createdAt: dayRange(now) },
        })) > 0
      : false;

    // Gate 2 — `now` is within ±1h of the scheduled start.
    const deltaMinutes = Math.round((now.getTime() - scheduledStart.getTime()) / 60_000);
    const withinWindow = Math.abs(deltaMinutes) <= 60;

    const clean = dailyCheckDone && withinWindow;
    const reason = opts.reason?.trim();

    if (!clean && !reason) {
      // Blocked — surface WHY so the driver UI can prompt for a reason note.
      const why: string[] = [];
      if (!dailyCheckDone) why.push('No daily vehicle check has been submitted today.');
      if (!withinWindow) {
        why.push(
          `Now is ${Math.abs(deltaMinutes)} min ${deltaMinutes < 0 ? 'before' : 'after'} the scheduled start (allowed: ±60 min).`,
        );
      }
      throw new BadRequestException({ error: 'TRIP_START_BLOCKED', message: why.join(' ') });
    }

    const updated = await this.transition(id, TripStatus.STARTED, { startedAt: now });

    if (!clean) {
      // Off-protocol start: persist the exception, then alert admins (fire-and-forget).
      const exception = await this.prisma.tripStartException.create({
        data: {
          tenantId: trip.tenantId,
          tripId: id,
          startedAt: now,
          scheduledStart,
          deltaMinutes,
          dailyCheckDone,
          reason: reason as string,
        },
      });
      this.notifyAdminsOfStartException(trip.tenantId, id, exception.reason).catch((err) =>
        this.logger.error(`TRIP_START_EXCEPTION dispatch failed: ${(err as Error).message}`),
      );
    }

    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_START).catch((err) =>
      this.logger.error(`TRIP_START dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Open (or all) trip-start exceptions for the alarm panel, tenant-scoped. */
  listStartExceptions(tenantId: string, opts: { resolved?: boolean } = {}) {
    const where: Prisma.TripStartExceptionWhereInput = { tenantId };
    if (opts.resolved === true) where.resolvedAt = { not: null };
    if (opts.resolved === false) where.resolvedAt = null;
    return this.prisma.tripStartException.findMany({
      where,
      include: { trip: { include: { route: true, vehicle: true, driver: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Resolve a trip-start exception — records the resolver + timestamp. Tenant-scoped. */
  async resolveStartException(id: string, tenantId: string, resolvedById: string) {
    const exception = await this.prisma.tripStartException.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exception) throw new NotFoundException(`Trip-start exception ${id} not found`);
    return this.prisma.tripStartException.update({
      where: { id },
      data: { resolvedById, resolvedAt: new Date() },
    });
  }

  /**
   * Derive a trip's planned departure from the route's age-group pickup/drop time
   * (by direction), applied to the trip's calendar day. Note: the "HH:mm" times are
   * wall-clock in the tenant timezone; for staging we apply them in the server's
   * local time. Falls back to the date itself when no age-group time exists.
   */
  private async deriveScheduledStart(
    routeId: string,
    tenantId: string,
    date: Date,
    direction: Direction,
  ): Promise<Date> {
    const ageGroups = await this.prisma.ageGroup.findMany({
      where: { tenantId, routeId },
      select: { pickupTime: true, dropTime: true },
    });
    const times = ageGroups
      .map((g) => (direction === Direction.PICKUP ? g.pickupTime : g.dropTime))
      .filter((t): t is string => !!t && /^\d{1,2}:\d{2}$/.test(t))
      .sort();
    if (!times.length) return date;
    const [h, m] = times[0].split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }

  /** Resolve the tenant's ACTIVE admins and dispatch the TRIP_START_EXCEPTION alarm. */
  private async notifyAdminsOfStartException(tenantId: string, tripId: string, reason: string) {
    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never }, status: 'ACTIVE' },
      select: { personId: true },
    });
    const recipientIds = [...new Set(admins.map((a) => a.personId))];
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.TRIP_START_EXCEPTION,
      tenantId,
      recipientIds,
      variables: { tripId, reason, deepLink: '/trips/exceptions' },
      entityId: tripId,
    });
  }

  async complete(id: string) {
    const updated = await this.transition(id, TripStatus.COMPLETED, { completedAt: new Date() });
    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_END).catch((err) =>
      this.logger.error(`TRIP_END dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Cancel a trip that hasn't started yet (e.g. vehicle breakdown before departure). */
  async cancel(id: string) {
    const updated = await this.transition(id, TripStatus.CANCELLED);
    this.notifyPickupCancelled(id).catch((err) =>
      this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Abort a trip already under way (mid-route emergency stop). */
  async abort(id: string) {
    const updated = await this.transition(id, TripStatus.ABORTED, { completedAt: new Date() });
    this.notifyPickupCancelled(id).catch((err) =>
      this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Resolve every guardian of every rider on the trip and dispatch a trip-lifecycle event. */
  private async notifyGuardiansOnTrip(tripId: string, eventType: NotifCategory) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { tenantId: true },
    });
    if (!trip) return;
    const riders = await this.prisma.tripRider.findMany({
      where: { tripId },
      select: { studentId: true },
    });
    if (!riders.length) return;
    const guardians = await this.prisma.guardianship.findMany({
      where: { studentId: { in: riders.map((r) => r.studentId) } },
      select: { personId: true },
    });
    const recipientIds = [...new Set(guardians.map((g) => g.personId))];
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType,
      tenantId: trip.tenantId,
      recipientIds,
      variables: { tripId, deepLink: `/track/${tripId}` },
      entityId: tripId,
    });
  }

  /** Resolve the trip's driver/conductor + tenant admins and dispatch PICKUP_CANCELLED. */
  private async notifyPickupCancelled(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { tenantId: true, vehicleId: true },
    });
    if (!trip) return;
    const recipientIds = new Set<string>();
    if (trip.vehicleId) {
      const assignments = await this.prisma.vehicleAssignment.findMany({
        where: { vehicleId: trip.vehicleId },
        include: { membership: { select: { personId: true } } },
      });
      for (const a of assignments) recipientIds.add(a.membership.personId);
    }
    const admins = await this.prisma.membership.findMany({
      where: { tenantId: trip.tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never } },
      select: { personId: true },
    });
    for (const a of admins) recipientIds.add(a.personId);
    if (!recipientIds.size) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.PICKUP_CANCELLED,
      tenantId: trip.tenantId,
      recipientIds: [...recipientIds],
      variables: { tripId, deepLink: `/track/${tripId}` },
      entityId: tripId,
    });
  }

  /**
   * Parent cancels a single child's pickup for this trip. Records a
   * PickupCancellation and flips that rider to CANCELLED so the driver roster
   * and not-boarded automation skip them.
   */
  async cancelPickup(tripId: string, studentId: string, cancelledBy: string, reason?: string) {
    const rider = await this.prisma.tripRider.findFirst({ where: { tripId, studentId } });
    if (!rider) throw new NotFoundException(`Student ${studentId} is not a rider on trip ${tripId}`);
    if (rider.boardStatus === RiderStatus.BOARDED) {
      throw new BadRequestException('Cannot cancel pickup — student already boarded');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { tenantId: true },
    });

    const [cancellation] = await this.prisma.$transaction([
      this.prisma.pickupCancellation.create({
        data: { tripId, studentId, tenantId: trip.tenantId, cancelledBy, reason },
      }),
      this.prisma.tripRider.update({
        where: { id: rider.id },
        data: { boardStatus: RiderStatus.CANCELLED },
      }),
    ]);
    return cancellation;
  }

  /**
   * Schedule a trip (PRD-02 FR-01/FR-02). Binds route + vehicle + driver +
   * optional conductor, then builds the roster: one TripRider (EXPECTED) for
   * every ACTIVE student assigned to the route who has a boarding stop — "the
   * roster of riders expected at each stop." Trip + riders are created in one
   * transaction so a half-built trip can never exist.
   *
   * Every referenced entity is verified to belong to the caller's tenant before
   * any write (NFR-05): a trip can never reference another school's route,
   * vehicle, or staff.
   */
  async create(data: {
    tenantId: string;
    routeId: string;
    vehicleId: string;
    driverId: string;
    conductorId?: string;
    date: Date;
    direction: Direction;
    scheduledStart?: Date;
  }) {
    const { tenantId, routeId, vehicleId, driverId, conductorId, date, direction } = data;

    const route = await this.prisma.route.findFirst({
      where: { id: routeId, tenantId },
      select: { id: true },
    });
    if (!route) throw new BadRequestException('Route not found in this school');

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { id: true },
    });
    if (!vehicle) throw new BadRequestException('Vehicle not found in this school');

    await this.assertActiveStaff(driverId, tenantId, Role.DRIVER, 'Driver');
    if (conductorId) await this.assertActiveStaff(conductorId, tenantId, Role.CONDUCTOR, 'Conductor');

    // Roster = ACTIVE students on this route that have a boarding stop. A
    // stop-less student can't be placed in the "expected at stop X" roster.
    const students = await this.prisma.student.findMany({
      where: { tenantId, routeId, status: 'ACTIVE', stopId: { not: null } },
      select: { id: true, stopId: true },
    });

    // Planned departure: admin-entered if supplied, else derived from the route's
    // age-group pickup/drop time (2B trip-start governance window).
    const scheduledStart =
      data.scheduledStart ?? (await this.deriveScheduledStart(routeId, tenantId, date, direction));

    return this.prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          tenantId,
          routeId,
          vehicleId,
          driverId,
          conductorId: conductorId ?? null,
          date,
          direction,
          scheduledStart,
          status: TripStatus.SCHEDULED,
        },
      });

      if (students.length) {
        await tx.tripRider.createMany({
          data: students.map((s) => ({
            tripId: trip.id,
            studentId: s.id,
            stopId: s.stopId as string,
            boardStatus: RiderStatus.EXPECTED,
          })),
        });
      }

      return tx.trip.findUniqueOrThrow({
        where: { id: trip.id },
        include: {
          route: true,
          vehicle: true,
          driver: true,
          conductor: true,
          riders: { include: { student: true, stop: true } },
        },
      });
    });
  }

  /** Verify a person holds an ACTIVE membership of the given role in this tenant. */
  private async assertActiveStaff(personId: string, tenantId: string, role: Role, label: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { personId, tenantId, role, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException(`${label} is not an active ${role.toLowerCase()} in this school`);
    }
  }

  /**
   * DEV ONLY: wipe a trip's tracking artifacts and return it to SCHEDULED so a
   * demo (e.g. the driver-ping simulator) can be replayed cleanly. Guarded at
   * the controller behind OTP_BYPASS_MODE.
   */
  async resetForDemo(tripId: string) {
    await this.prisma.$transaction([
      this.prisma.attendanceEvent.deleteMany({ where: { tripId } }),
      this.prisma.geofenceEvent.deleteMany({ where: { tripId } }),
      this.prisma.speedEvent.deleteMany({ where: { tripId } }),
      this.prisma.pickupCancellation.deleteMany({ where: { tripId } }),
      this.prisma.locationPing.deleteMany({ where: { tripId } }),
      this.prisma.tripRider.updateMany({ where: { tripId }, data: { boardStatus: RiderStatus.EXPECTED } }),
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.SCHEDULED, startedAt: null, completedAt: null },
      }),
    ]);
    await this.location.clearTripCache(tripId);
    return { tripId, status: TripStatus.SCHEDULED, reset: true };
  }
}
