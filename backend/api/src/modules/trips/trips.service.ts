import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

/** `from` shifted exactly one calendar month forward (the scheduling horizon). */
function oneMonthAhead(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

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

  /** Default minutes-before-scheduled-start cutoff for parent pickup cancellation (FR-21). */
  private static readonly DEFAULT_PICKUP_CANCEL_CUTOFF_MIN = 30;

  /** Hours past planned start after which a still-SCHEDULED trip is a never-started anomaly. */
  private static readonly NOT_STARTED_ALARM_HOURS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TrackingGateway,
    private readonly location: LocationService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
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

  list(
    actor: ActiveMembership,
    filters?: { date?: Date; status?: TripStatus; routeId?: string; driverId?: string },
  ) {
    return this.prisma.trip.findMany({
      // The role scope and the admin filters are AND-ed so a filter can only ever
      // narrow within the caller's scope (NFR-05) — e.g. a DRIVER passing
      // `?driver=` for someone else yields nothing rather than leaking their trips.
      where: {
        AND: [
          this.scopeForActor(actor),
          {
            ...(filters?.date && { date: dayRange(filters.date) }),
            ...(filters?.status && { status: filters.status }),
            ...(filters?.routeId && { routeId: filters.routeId }),
            ...(filters?.driverId && { driverId: filters.driverId }),
          },
        ],
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

  /**
   * Single trip, scoped to the actor (NFR-05). A PARENT receives only the
   * riders and attendance events for the children they actually guard — never
   * another family's boarding status or photo — and only if the trip carries
   * one of their children at all (otherwise it 404s like any out-of-scope
   * trip). DRIVER / CONDUCTOR / admins get the full trip within their tenant.
   */
  async findById(id: string, actor: ActiveMembership) {
    // Resolve the parent's guarded students once, so we can both gate access
    // and filter the rider/attendance payload to just those children.
    let guardedStudentIds: Set<string> | null = null;
    if (actor.role === Role.PARENT) {
      const guardianships = await this.prisma.guardianship.findMany({
        where: { personId: actor.personId, student: { tenantId: actor.tenantId } },
        select: { studentId: true },
      });
      guardedStudentIds = new Set(guardianships.map((g) => g.studentId));
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
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

    // Tenant isolation for every role.
    if (trip.tenantId !== actor.tenantId) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    if (guardedStudentIds) {
      const ownRiders = trip.riders.filter((r) => guardedStudentIds!.has(r.studentId));
      // A parent has no business loading a trip that carries none of their
      // children — surface it as not-found rather than an empty trip.
      if (ownRiders.length === 0) {
        throw new NotFoundException(`Trip ${id} not found`);
      }
      return {
        ...trip,
        riders: ownRiders,
        // Strip every other child's attendance event (and thus their photoUrl)
        // before the payload ever leaves the server.
        attendanceEvents: trip.attendanceEvents.filter((e) => guardedStudentIds!.has(e.studentId)),
      };
    }

    return trip;
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

  /**
   * Driver ride history + efficiency summary (scoped to the actor like every other
   * trip read, NFR-05). "Past" trips are those that have finished their lifecycle
   * (COMPLETED / CANCELLED / ABORTED) or whose calendar day is before today — so a
   * still-SCHEDULED future trip never shows up as history.
   *
   * Each row carries the real, computed fields the history screen needs:
   *  - boarded / total / expected rider counts (from the roster)
   *  - duration in minutes (completedAt − startedAt) when both exist
   *  - whether a vehicle check was done (a DailyCheck linked to the trip, or for the
   *    trip's vehicle on the trip's calendar day — mirrors the home-screen logic)
   *  - onTime: started, and NOT recorded as a start exception (off-protocol start)
   *
   * The summary aggregates these across the whole scoped history:
   *  - tripsCompleted, totalTrips
   *  - onTimeRate = on-time starts / trips that actually started
   *  - avgBoardingRate = Σ boarded / Σ expected-to-board (boarded + not-boarded + still-expected)
   */
  async getDriverHistory(actor: ActiveMembership) {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const trips = await this.prisma.trip.findMany({
      where: {
        AND: [
          this.scopeForActor(actor),
          {
            OR: [
              { status: { in: [TripStatus.COMPLETED, TripStatus.CANCELLED, TripStatus.ABORTED] } },
              { date: { lt: todayEnd } },
            ],
          },
        ],
      },
      include: {
        route: { select: { id: true, name: true } },
        vehicle: { select: { id: true, regNumber: true } },
        riders: { select: { boardStatus: true } },
        startExceptions: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    });

    if (trips.length === 0) {
      return {
        trips: [],
        summary: { totalTrips: 0, tripsCompleted: 0, onTimeRate: null, avgBoardingRate: null },
      };
    }

    // Resolve vehicle checks for every vehicle referenced by these trips in one
    // query, then match per-trip (linked tripId, or same vehicle on the trip's day).
    const vehicleIds = [...new Set(trips.map((t) => t.vehicleId).filter((v): v is string => !!v))];
    const checks = vehicleIds.length
      ? await this.prisma.dailyCheck.findMany({
          where: { tenantId: actor.tenantId, vehicleId: { in: vehicleIds } },
          select: { tripId: true, vehicleId: true, createdAt: true },
        })
      : [];
    const checkedTripIds = new Set(checks.map((c) => c.tripId).filter((id): id is string => !!id));
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const checkedVehicleDay = new Set(checks.map((c) => `${c.vehicleId}|${dayKey(c.createdAt)}`));

    // A trip that ever started: STARTED / IN_PROGRESS / COMPLETED. Compared as
    // strings so the Prisma enum and @saarthi/types enum interop cleanly.
    const STARTED_STATUSES = new Set<string>([
      TripStatus.STARTED,
      TripStatus.IN_PROGRESS,
      TripStatus.COMPLETED,
    ]);

    let startedCount = 0;
    let onTimeCount = 0;
    let boardedSum = 0;
    let expectedSum = 0;
    let completedCount = 0;

    const rows = trips.map((t) => {
      const boarded = t.riders.filter((r) => r.boardStatus === RiderStatus.BOARDED).length;
      const notBoarded = t.riders.filter((r) => r.boardStatus === RiderStatus.NOT_BOARDED).length;
      const expectedStill = t.riders.filter((r) => r.boardStatus === RiderStatus.EXPECTED).length;
      const total = t.riders.length;
      // Riders who were meant to board (excludes CANCELLED pickups).
      const expectedToBoard = boarded + notBoarded + expectedStill;

      const durationMinutes =
        t.startedAt && t.completedAt
          ? Math.max(0, Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60_000))
          : null;

      const vehicleChecked =
        checkedTripIds.has(t.id) ||
        (!!t.vehicleId && checkedVehicleDay.has(`${t.vehicleId}|${dayKey(t.date)}`));

      const started = STARTED_STATUSES.has(t.status);
      // On-time = it started AND was not flagged as an off-protocol start.
      const onTime = started ? t.startExceptions.length === 0 : null;

      if (started) {
        startedCount += 1;
        if (onTime) onTimeCount += 1;
      }
      if (t.status === TripStatus.COMPLETED) completedCount += 1;
      boardedSum += boarded;
      expectedSum += expectedToBoard;

      return {
        id: t.id,
        date: t.date,
        scheduledStart: t.scheduledStart,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        direction: t.direction,
        status: t.status,
        route: t.route,
        vehicle: t.vehicle,
        boarded,
        notBoarded,
        total,
        expectedToBoard,
        durationMinutes,
        vehicleChecked,
        onTime,
      };
    });

    return {
      trips: rows,
      summary: {
        totalTrips: trips.length,
        tripsCompleted: completedCount,
        onTimeRate: startedCount > 0 ? onTimeCount / startedCount : null,
        avgBoardingRate: expectedSum > 0 ? boardedSum / expectedSum : null,
      },
    };
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
      select: { id: true, tenantId: true, vehicleId: true, driverId: true, scheduledStart: true, date: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    // One live trip per driver (3-rule §2): a driver already running a
    // STARTED/IN_PROGRESS trip cannot start another. Block it before the start
    // governance gates so the message is unambiguous.
    if (trip.driverId) {
      const live = await this.prisma.trip.findFirst({
        where: {
          driverId: trip.driverId,
          status: { in: [TripStatus.STARTED, TripStatus.IN_PROGRESS] },
          id: { not: id },
        },
        select: { id: true },
      });
      if (live) {
        throw new BadRequestException({
          error: 'TRIP_ALREADY_LIVE',
          message: 'You already have a trip under way. Complete it before starting another.',
        });
      }
    }

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

  /**
   * Read-computed "never started" alarm feed (admin panel): trips still SCHEDULED
   * more than {@link NOT_STARTED_ALARM_HOURS}h past their planned start, scoped to
   * the actor (NFR-05) like every other trip read. Each comes back with its
   * route/driver/vehicle and how overdue it is, and fires a deduped fire-and-forget
   * admin notification so the alarm reaches admins who aren't looking at the panel.
   *
   * NOTE: computing on read (here) is fine for now; the production-grade trigger is
   * a scheduled job (cron) that periodically sweeps for stale SCHEDULED trips and
   * dispatches once — the Redis dedup means either trigger is safe to run.
   */
  async listOverdueScheduled(actor: ActiveMembership) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - TripsService.NOT_STARTED_ALARM_HOURS * 60 * 60_000);

    const trips = await this.prisma.trip.findMany({
      where: {
        AND: [
          this.scopeForActor(actor),
          { status: TripStatus.SCHEDULED },
          // Effective start = scheduledStart ?? date; overdue when it predates the cutoff.
          { OR: [{ scheduledStart: { lt: cutoff } }, { scheduledStart: null, date: { lt: cutoff } }] },
        ],
      },
      include: { route: true, vehicle: true, driver: true, conductor: true },
      orderBy: { date: 'asc' },
    });

    const result = trips.map((t) => {
      const start = t.scheduledStart ?? t.date;
      const overdueMinutes = Math.max(0, Math.round((now.getTime() - start.getTime()) / 60_000));
      return { ...t, overdueMinutes };
    });

    if (result.length) {
      this.notifyAdminsOfOverdueTrips(actor.tenantId, result).catch((err) =>
        this.logger.error(`TRIP_NOT_STARTED dispatch failed: ${(err as Error).message}`),
      );
    }
    return result;
  }

  /** Resolve tenant admins once, then dispatch a deduped TRIP_NOT_STARTED per overdue trip. */
  private async notifyAdminsOfOverdueTrips(
    tenantId: string,
    trips: { id: string; overdueMinutes: number; route?: { name: string } | null }[],
  ) {
    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never }, status: 'ACTIVE' },
      select: { personId: true },
    });
    const recipientIds = [...new Set(admins.map((a) => a.personId))];
    if (!recipientIds.length) return;
    for (const t of trips) {
      await this.notifications.dispatch({
        eventType: NotifCategory.TRIP_NOT_STARTED,
        tenantId,
        recipientIds,
        variables: {
          tripId: t.id,
          routeName: t.route?.name ?? 'A trip',
          overdueHours: String(Math.floor(t.overdueMinutes / 60)),
          deepLink: '/trips/exceptions',
        },
        entityId: t.id,
      });
    }
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

  /** Open (or all) trip-completion (early-end) exceptions for the alarm panel, tenant-scoped. */
  listCompletionExceptions(tenantId: string, opts: { resolved?: boolean } = {}) {
    const where: Prisma.TripCompletionExceptionWhereInput = { tenantId };
    if (opts.resolved === true) where.resolvedAt = { not: null };
    if (opts.resolved === false) where.resolvedAt = null;
    return this.prisma.tripCompletionException.findMany({
      where,
      include: { trip: { include: { route: true, vehicle: true, driver: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Resolve a trip-completion exception — records the resolver + timestamp. Tenant-scoped. */
  async resolveCompletionException(id: string, tenantId: string, resolvedById: string) {
    const exception = await this.prisma.tripCompletionException.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exception) throw new NotFoundException(`Trip-completion exception ${id} not found`);
    return this.prisma.tripCompletionException.update({
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

  /**
   * Complete a trip (3-rule §1/§5/§6). A trip can only be completed once it is
   * STARTED or IN_PROGRESS — the SCHEDULED→COMPLETED edge is absent from the
   * state machine, and this re-checks it up front so the driver gets a clear
   * message instead of the generic transition error.
   *
   * If the trip is completed BEFORE its final stop has been serviced, a `reason`
   * note is MANDATORY (mirrors the start-governance pattern): completing early
   * records a TripCompletionException and fires a fire-and-forget admin alarm so
   * the ADMIN is notified. Reaching the final stop completes normally with no
   * note required.
   */
  async complete(id: string, opts: { reason?: string; stoppedAtSeq?: number } = {}) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true, tenantId: true, status: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    // §1 — a trip must be under way before it can be completed.
    if (trip.status !== TripStatus.STARTED && trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException({
        error: 'TRIP_NOT_STARTED',
        message: `Cannot complete a trip that is ${trip.status.toLowerCase()} — start it first.`,
      });
    }

    // Total serviceable stops = distinct stops that actually carry riders, which is
    // exactly what the driver app walks (the roster). Matching the client's notion
    // of "stops" keeps `stoppedAtSeq` and the early/final decision consistent.
    const riderStops = await this.prisma.tripRider.findMany({
      where: { tripId: id },
      select: { stopId: true },
      distinct: ['stopId'],
    });
    const totalStops = riderStops.length;
    // The driver reports which stop they stopped at (1-based). Without it we treat
    // the completion as final (no early-completion alarm).
    const stoppedAtSeq = opts.stoppedAtSeq ?? totalStops;
    const isEarly = totalStops > 0 && stoppedAtSeq < totalStops;
    const reason = opts.reason?.trim();

    // §5 — completing before the final stop requires a reason note.
    if (isEarly && !reason) {
      throw new BadRequestException({
        error: 'TRIP_COMPLETE_EARLY',
        message: `This trip has ${totalStops} stops and you're completing at stop ${stoppedAtSeq}. Add a reason to complete early.`,
      });
    }

    const now = new Date();
    const updated = await this.transition(id, TripStatus.COMPLETED, { completedAt: now });

    if (isEarly) {
      // Off-protocol completion: persist the exception, then alert admins (fire-and-forget).
      const roster = await this.getRosterSummary(id);
      const exception = await this.prisma.tripCompletionException.create({
        data: {
          tenantId: trip.tenantId,
          tripId: id,
          completedAt: now,
          stoppedAtSeq,
          totalStops,
          boarded: roster.boarded,
          totalRiders: roster.total,
          reason: reason as string,
        },
      });
      this.notifyAdminsOfEarlyCompletion(trip.tenantId, id, exception.reason).catch((err) =>
        this.logger.error(`TRIP_EARLY_COMPLETE dispatch failed: ${(err as Error).message}`),
      );
    }

    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_END).catch((err) =>
      this.logger.error(`TRIP_END dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Lightweight boarded/total counts for a trip's riders (early-completion record). */
  private async getRosterSummary(tripId: string): Promise<{ total: number; boarded: number }> {
    const riders = await this.prisma.tripRider.findMany({
      where: { tripId },
      select: { boardStatus: true },
    });
    return {
      total: riders.length,
      boarded: riders.filter((r) => r.boardStatus === RiderStatus.BOARDED).length,
    };
  }

  /** Resolve the tenant's ACTIVE admins and dispatch the TRIP_EARLY_COMPLETE alarm. */
  private async notifyAdminsOfEarlyCompletion(tenantId: string, tripId: string, reason: string) {
    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never }, status: 'ACTIVE' },
      select: { personId: true },
    });
    const recipientIds = [...new Set(admins.map((a) => a.personId))];
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.TRIP_EARLY_COMPLETE,
      tenantId,
      recipientIds,
      variables: { tripId, reason, deepLink: '/trips/exceptions' },
      entityId: tripId,
    });
  }

  /**
   * Cancel a trip that hasn't started yet (e.g. vehicle breakdown before
   * departure). Tenant-scoped (NFR-05): a trip id from another school 404s before
   * any state change. The SCHEDULED→CANCELLED guard lives in `transition`.
   */
  async cancel(id: string, tenantId: string) {
    await this.assertOwned(id, tenantId);
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

  /**
   * Resolve the trip's driver/conductor + tenant admins and dispatch
   * PICKUP_CANCELLED. With no `student` this is a whole-trip cancel/abort
   * (dedup keyed by tripId); with a `student` it's a single-rider cancellation
   * (FR-22) — dedup keyed per student so two riders cancelled on the same trip
   * both notify, and the student's name rides along in the message.
   */
  private async notifyPickupCancelled(
    tripId: string,
    student?: { studentId: string; studentName: string },
  ) {
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
      variables: {
        tripId,
        ...(student ? { studentName: student.studentName } : {}),
        deepLink: `/track/${tripId}`,
      },
      entityId: student ? `pickup:${tripId}:${student.studentId}` : tripId,
    });
  }

  /** Configured minutes-before-scheduled-start cutoff for cancelling a pickup (FR-21). */
  private pickupCancelCutoffMinutes(): number {
    const raw = this.config.get<string>('PICKUP_CANCEL_CUTOFF_MINUTES');
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : TripsService.DEFAULT_PICKUP_CANCEL_CUTOFF_MIN;
  }

  /**
   * Parent cancels a single child's pickup for this trip (PRD-02 FR-21/FR-22).
   *
   * Allowed only while the trip is still SCHEDULED and `now` is before the cutoff
   * (a configurable number of minutes before scheduledStart, default 30): once the
   * trip has STARTED/IN_PROGRESS, or the cutoff has passed, this rejects with a
   * clear message. On success it records a PickupCancellation, flips the rider to
   * CANCELLED so the driver roster and not-boarded automation skip them (FR-22),
   * and notifies the driver/conductor + admin (fire-and-forget). The cutoff info
   * is returned either way so the client can show/hide the action.
   */
  async cancelPickup(tripId: string, studentId: string, cancelledBy: string, reason?: string) {
    const rider = await this.prisma.tripRider.findFirst({
      where: { tripId, studentId },
      include: { student: { select: { name: true } } },
    });
    if (!rider) throw new NotFoundException(`Student ${studentId} is not a rider on trip ${tripId}`);
    if (rider.boardStatus === RiderStatus.BOARDED) {
      throw new BadRequestException('Cannot cancel pickup — student already boarded');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { tenantId: true, status: true, scheduledStart: true, date: true },
    });

    const cutoffMinutes = this.pickupCancelCutoffMinutes();
    const scheduledStart = trip.scheduledStart ?? trip.date;
    const cutoffAt = new Date(scheduledStart.getTime() - cutoffMinutes * 60_000);
    const now = new Date();
    const cutoff = {
      cutoffMinutes,
      cutoffAt: cutoffAt.toISOString(),
      scheduledStart: scheduledStart.toISOString(),
    };

    // Gate 1 — the trip must still be SCHEDULED (not started / underway / finished).
    if (trip.status !== TripStatus.SCHEDULED) {
      const underway = trip.status === TripStatus.STARTED || trip.status === TripStatus.IN_PROGRESS;
      throw new BadRequestException({
        error: 'PICKUP_CANCEL_CLOSED',
        message: underway
          ? 'Cannot cancel pickup — the trip is already under way.'
          : `Cannot cancel pickup — the trip is ${trip.status.toLowerCase()}.`,
        cutoff,
      });
    }

    // Gate 2 — `now` must be before the cutoff.
    if (now.getTime() > cutoffAt.getTime()) {
      throw new BadRequestException({
        error: 'PICKUP_CANCEL_CLOSED',
        message: `Cannot cancel pickup — the cutoff is ${cutoffMinutes} min before departure, which has passed.`,
        cutoff,
      });
    }

    const [cancellation] = await this.prisma.$transaction([
      this.prisma.pickupCancellation.create({
        data: { tripId, studentId, tenantId: trip.tenantId, cancelledBy, reason },
      }),
      this.prisma.tripRider.update({
        where: { id: rider.id },
        data: { boardStatus: RiderStatus.CANCELLED },
      }),
    ]);

    // FR-22: notify driver/conductor + admin that this rider won't be boarding.
    this.notifyPickupCancelled(tripId, {
      studentId,
      studentName: rider.student.name,
    }).catch((err) =>
      this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
    );

    return { cancellation, cutoff: { ...cutoff, canCancel: true } };
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

    // Empty-route guard: a route with no stops, or no ACTIVE stop-pinned students,
    // has no one to carry — block scheduling so a driver is never handed an empty
    // trip. Mirrored client-side (the scheduler disables submit) but enforced here
    // so no caller can create an empty trip.
    if (students.length === 0) {
      const stopCount = await this.prisma.routeStop.count({ where: { routeId } });
      throw new BadRequestException(
        stopCount === 0
          ? 'This route has no stops — add stops and assign students to them before scheduling a trip.'
          : 'This route has no eligible riders — assign active students to a stop on this route before scheduling.',
      );
    }

    // Planned departure: admin-entered if supplied, else derived from the route's
    // age-group pickup/drop time (2B trip-start governance window).
    const scheduledStart =
      data.scheduledStart ?? (await this.deriveScheduledStart(routeId, tenantId, date, direction));

    // Scheduling window (mirrors the admin client): the planned start must fall
    // between now and one month ahead. Re-validated here so the rule holds for
    // any caller, not just the UI. A small grace on each side absorbs request
    // latency, clock skew, and the client's booking buffer without rejecting a
    // request the client already accepted.
    const now = new Date();
    const lowerBound = now.getTime() - 2 * 60_000;
    const upperBound = oneMonthAhead(now).getTime() + 24 * 60 * 60_000;
    const startMs = scheduledStart.getTime();
    if (startMs < lowerBound || startMs > upperBound) {
      throw new BadRequestException('Trips can only be scheduled between now and one month ahead.');
    }

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

  /** Verify a trip belongs to this tenant (NFR-05) before any mutation. */
  private async assertOwned(id: string, tenantId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
  }

  /**
   * Edit a SCHEDULED trip's plan: driver / vehicle / conductor / scheduledStart /
   * direction / route. Allowed ONLY while the trip is still SCHEDULED — once it
   * has started, completed, cancelled or aborted it is immutable and this rejects
   * with a clear message. Tenant-scoped (NFR-05): every referenced entity is
   * re-verified to belong to the caller's school, mirroring `create`. If the
   * route changes the roster is rebuilt from the new route's ACTIVE, stop-assigned
   * students — all within one transaction so a half-edited trip can never exist.
   */
  async editScheduled(
    id: string,
    tenantId: string,
    patch: {
      routeId?: string;
      vehicleId?: string;
      driverId?: string;
      conductorId?: string | null;
      direction?: Direction;
      scheduledStart?: Date;
    },
  ) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, routeId: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    if (trip.status !== TripStatus.SCHEDULED) {
      throw new BadRequestException(
        `Only scheduled trips can be edited — this trip is ${trip.status.toLowerCase()}.`,
      );
    }

    // Re-verify every referenced entity is in this tenant before any write.
    if (patch.routeId) {
      const route = await this.prisma.route.findFirst({
        where: { id: patch.routeId, tenantId },
        select: { id: true },
      });
      if (!route) throw new BadRequestException('Route not found in this school');
    }
    if (patch.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: patch.vehicleId, tenantId },
        select: { id: true },
      });
      if (!vehicle) throw new BadRequestException('Vehicle not found in this school');
    }
    if (patch.driverId) await this.assertActiveStaff(patch.driverId, tenantId, Role.DRIVER, 'Driver');
    if (patch.conductorId) {
      await this.assertActiveStaff(patch.conductorId, tenantId, Role.CONDUCTOR, 'Conductor');
    }

    const routeChanged = !!patch.routeId && patch.routeId !== trip.routeId;
    const newRouteId = patch.routeId ?? trip.routeId;

    // Re-routing onto an empty route would leave the trip with no riders — block it
    // (a driver can't be assigned an empty route). Only enforced when the route
    // actually changes, so editing time/driver on an existing trip is never blocked.
    if (routeChanged) {
      const eligible = await this.prisma.student.count({
        where: { tenantId, routeId: newRouteId, status: 'ACTIVE', stopId: { not: null } },
      });
      if (eligible === 0) {
        throw new BadRequestException(
          'This route has no eligible riders — assign active students to a stop on it before assigning a trip to it.',
        );
      }
    }

    const data: Prisma.TripUncheckedUpdateInput = {};
    if (patch.routeId !== undefined) data.routeId = patch.routeId;
    if (patch.vehicleId !== undefined) data.vehicleId = patch.vehicleId;
    if (patch.driverId !== undefined) data.driverId = patch.driverId;
    if (patch.conductorId !== undefined) data.conductorId = patch.conductorId;
    if (patch.direction !== undefined) data.direction = patch.direction;
    if (patch.scheduledStart !== undefined) data.scheduledStart = patch.scheduledStart;

    return this.prisma.$transaction(async (tx) => {
      if (routeChanged) {
        // Rebuild the roster for the new route — old riders no longer apply.
        await tx.tripRider.deleteMany({ where: { tripId: id } });
        const students = await tx.student.findMany({
          where: { tenantId, routeId: newRouteId, status: 'ACTIVE', stopId: { not: null } },
          select: { id: true, stopId: true },
        });
        if (students.length) {
          await tx.tripRider.createMany({
            data: students.map((s) => ({
              tripId: id,
              studentId: s.id,
              stopId: s.stopId as string,
              boardStatus: RiderStatus.EXPECTED,
            })),
          });
        }
      }

      await tx.trip.update({ where: { id }, data });

      return tx.trip.findUniqueOrThrow({
        where: { id },
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
