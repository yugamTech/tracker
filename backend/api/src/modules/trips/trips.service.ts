import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TripLifecycleAction } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';
import { TripStatus, RiderStatus, NotifCategory, Role, Direction } from '@yaanam/types';
import type { ActiveMembership } from '@yaanam/types';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { LocationService } from '../tracking/location.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveSchoolAnchor } from './school-anchor.util';

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

/**
 * Apply a "HH:MM" wall-clock time to a calendar day, in the server's local time
 * (the staging stand-in for the tenant timezone, matching `deriveScheduledStart`).
 * Returns null for a malformed time so callers can fall back gracefully.
 */
function applyHHMMToDate(hhmm: string, date: Date): Date | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Validate a trip's optional school-end override: latitude and longitude must be
 * supplied together (a half-set anchor is rejected), within valid geographic
 * range. The label is optional alongside them. Returns null when no override was
 * provided at all, so a normal trip needs zero extra input.
 */
function normaliseAnchorOverride(data: {
  anchorLat?: number;
  anchorLng?: number;
  anchorLabel?: string;
}): { lat: number; lng: number; label: string | null } | null {
  const { anchorLat, anchorLng, anchorLabel } = data;
  const anySet = anchorLat !== undefined || anchorLng !== undefined || (anchorLabel ?? '') !== '';
  if (!anySet) return null;
  if (anchorLat === undefined || anchorLng === undefined) {
    throw new BadRequestException(
      'A different-destination override needs both a latitude and a longitude (or leave it off entirely).',
    );
  }
  if (anchorLat < -90 || anchorLat > 90) {
    throw new BadRequestException('anchorLat must be between -90 and 90.');
  }
  if (anchorLng < -180 || anchorLng > 180) {
    throw new BadRequestException('anchorLng must be between -180 and 180.');
  }
  return { lat: anchorLat, lng: anchorLng, label: anchorLabel?.trim() || null };
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  /** Default minutes-before-scheduled-start cutoff for parent pickup cancellation (FR-21). */
  private static readonly DEFAULT_PICKUP_CANCEL_CUTOFF_MIN = 30;

  /** Hours past planned start after which a still-SCHEDULED trip is a never-started anomaly. */
  private static readonly NOT_STARTED_ALARM_HOURS = 12;

  // ── Started-not-completed thresholds (PRD-02a §8). Named constants in the same
  // style as NOT_STARTED_ALARM_HOURS, structured so per-tenant tuning is a one-line
  // change later. No inline magic numbers.

  /** Stage-1 (soft overdue) cutoff = scheduledEnd + this, when an end time is known. */
  private static readonly STAGE1_OVERDUE_AFTER_SCHEDULED_END_HOURS = 2;
  /** Stage-1 (soft overdue) cutoff = startedAt + this, when no end time is known.
   *  This milestone stores no scheduledEnd (PRD-02a §6), so this is the effective rule. */
  private static readonly STAGE1_OVERDUE_AFTER_START_HOURS = 3;
  /** Stage-2 (hard abandoned) cutoff = startedAt + this → SYSTEM auto-abort. */
  private static readonly STAGE2_ABANDONED_AFTER_START_HOURS = 6;
  /** Founder decision: notify affected parents (not just driver/admin) on abort. */
  private static readonly NOTIFY_PARENTS_ON_ABORT = true;

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
        shift: true,
        riders: { include: { student: true, stop: true } },
        attendanceEvents: { orderBy: { ts: 'asc' } },
        geofenceEvents: { orderBy: { ts: 'asc' } },
        // School-end resolution needs the tenant's campus coordinates as fallback.
        tenant: { select: { schoolLat: true, schoolLng: true, schoolName: true } },
      },
    });

    // Tenant isolation for every role.
    if (trip.tenantId !== actor.tenantId) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    // Resolve the trip's "school end" (per-trip override → tenant school coords →
    // none) and its role (DESTINATION for a PICKUP, ORIGIN for a DROP) so the map
    // payload can graft it onto the route geometry. Omitted gracefully when unset.
    const anchor = resolveSchoolAnchor(trip, trip.tenant);

    if (guardedStudentIds) {
      const ownRiders = trip.riders.filter((r) => guardedStudentIds!.has(r.studentId));
      // A parent has no business loading a trip that carries none of their
      // children — surface it as not-found rather than an empty trip.
      if (ownRiders.length === 0) {
        throw new NotFoundException(`Trip ${id} not found`);
      }
      return {
        ...trip,
        anchor,
        riders: ownRiders,
        // Strip every other child's attendance event (and thus their photoUrl)
        // before the payload ever leaves the server.
        attendanceEvents: trip.attendanceEvents.filter((e) => guardedStudentIds!.has(e.studentId)),
      };
    }

    return { ...trip, anchor };
  }

  /**
   * Read-only lifecycle-event timeline for a single trip (PRD-02a §5 audit
   * trail), oldest-first so a post-mortem can render it as a chronological
   * story. Scoped to the actor exactly like {@link findById}: you can read a
   * trip's lifecycle only if the trip itself is in your scope. Purely additive —
   * no existing behaviour relies on it.
   */
  async getLifecycleEvents(id: string, actor: ActiveMembership) {
    const trip = await this.prisma.trip.findFirst({
      where: { AND: [this.scopeForActor(actor), { id }] },
      select: { id: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return this.prisma.tripLifecycleEvent.findMany({
      where: { tripId: id },
      orderBy: { createdAt: 'asc' },
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
              {
                status: {
                  // Include STARTED/IN_PROGRESS so a stuck (started-not-completed) trip
                  // is never hidden from history (PRD-02a §4), alongside finished trips.
                  in: [
                    TripStatus.COMPLETED,
                    TripStatus.CANCELLED,
                    TripStatus.ABORTED,
                    TripStatus.STARTED,
                    TripStatus.IN_PROGRESS,
                  ],
                },
              },
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
        // Latest abort reason (auto or forced) so an ABORTED row can badge "Aborted: <reason>".
        lifecycleEvents: {
          where: {
            action: { in: [TripLifecycleAction.AUTO_ABORTED, TripLifecycleAction.FORCE_ABORTED] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { reason: true },
        },
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
    // strings so the Prisma enum and @yaanam/types enum interop cleanly.
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

      // A trip that didn't reach a clean COMPLETED — still running/stuck, or aborted —
      // so the UI can badge it "In progress" / "Incomplete" / "Aborted: <reason>" (PRD-02a §4).
      const incomplete =
        t.status === TripStatus.STARTED ||
        t.status === TripStatus.IN_PROGRESS ||
        t.status === TripStatus.ABORTED;
      const abortReason =
        t.status === TripStatus.ABORTED ? t.lifecycleEvents[0]?.reason ?? null : null;

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
        incomplete,
        abortReason,
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

  /**
   * Tenant-wide daily operations trend over the last `days` calendar days (incl.
   * today), for the admin Dashboard → Trends screen. Actor-scoped exactly like the
   * rest of the module, so an admin sees the whole tenant. Reuses the same on-time
   * (no start exception) and boarding-rate definitions as `getDriverHistory`.
   *
   * Returns one bucket per day in chronological order — empty days are included
   * with zero counts / null rates so charts render a continuous series.
   */
  async getTrends(actor: ActiveMembership, days = 7) {
    const span = Math.min(Math.max(Math.trunc(days) || 7, 1), 90);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (span - 1));
    start.setHours(0, 0, 0, 0);

    const trips = await this.prisma.trip.findMany({
      where: { AND: [this.scopeForActor(actor), { date: { gte: start, lte: end } }] },
      select: {
        date: true,
        status: true,
        riders: { select: { boardStatus: true } },
        startExceptions: { select: { id: true } },
      },
    });

    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    interface Bucket {
      date: string;
      tripsTotal: number;
      tripsCompleted: number;
      started: number;
      onTime: number;
      boardedSum: number;
      expectedSum: number;
    }
    // Seed a bucket for every day in the window (insertion order = chronological).
    const buckets = new Map<string, Bucket>();
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      buckets.set(key, {
        date: key, tripsTotal: 0, tripsCompleted: 0, started: 0, onTime: 0, boardedSum: 0, expectedSum: 0,
      });
    }

    const STARTED = new Set<string>([TripStatus.STARTED, TripStatus.IN_PROGRESS, TripStatus.COMPLETED]);

    for (const t of trips) {
      const b = buckets.get(dayKey(t.date));
      if (!b) continue;
      b.tripsTotal += 1;
      if (t.status === TripStatus.COMPLETED) b.tripsCompleted += 1;
      if (STARTED.has(t.status)) {
        b.started += 1;
        // On-time = started AND not flagged as an off-protocol start.
        if (t.startExceptions.length === 0) b.onTime += 1;
      }
      const boarded = t.riders.filter((r) => r.boardStatus === RiderStatus.BOARDED).length;
      const notBoarded = t.riders.filter((r) => r.boardStatus === RiderStatus.NOT_BOARDED).length;
      const expectedStill = t.riders.filter((r) => r.boardStatus === RiderStatus.EXPECTED).length;
      b.boardedSum += boarded;
      // Riders who were meant to board (excludes CANCELLED pickups).
      b.expectedSum += boarded + notBoarded + expectedStill;
    }

    return [...buckets.values()].map((b) => ({
      date: b.date,
      tripsTotal: b.tripsTotal,
      tripsCompleted: b.tripsCompleted,
      onTimeRate: b.started > 0 ? b.onTime / b.started : null,
      boardingRate: b.expectedSum > 0 ? b.boardedSum / b.expectedSum : null,
    }));
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
   * Stage-1 (soft overdue) cutoff for a live trip (PRD-02a §3.2): the instant past
   * which a STARTED/IN_PROGRESS trip is "running overdue". No scheduledEnd is stored
   * this milestone (§6), so this resolves to startedAt + STAGE1_OVERDUE_AFTER_START_HOURS;
   * the scheduledEnd + 2h branch is reserved for when an end time is modelled. Null
   * when the trip never recorded a startedAt (can't be overdue).
   */
  private stage1OverdueAt(trip: { startedAt: Date | null }): Date | null {
    if (!trip.startedAt) return null;
    return new Date(
      trip.startedAt.getTime() + TripsService.STAGE1_OVERDUE_AFTER_START_HOURS * 60 * 60_000,
    );
  }

  /** Stage-2 (hard abandoned) cutoff = startedAt + STAGE2_ABANDONED_AFTER_START_HOURS. */
  private stage2AbandonedAt(trip: { startedAt: Date | null }): Date | null {
    if (!trip.startedAt) return null;
    return new Date(
      trip.startedAt.getTime() + TripsService.STAGE2_ABANDONED_AFTER_START_HOURS * 60 * 60_000,
    );
  }

  /** Append an immutable lifecycle-audit row (PRD-02a §5). Never updated/deleted. */
  private writeLifecycleEvent(
    tenantId: string,
    tripId: string,
    action: TripLifecycleAction,
    actor: string,
    reason?: string | null,
  ) {
    return this.prisma.tripLifecycleEvent.create({
      data: { tenantId, tripId, action, actor, reason: reason ?? null },
    });
  }

  /**
   * Start a trip under the trip-start governance rule (2B). A trip starts CLEANLY
   * only if BOTH a DailyCheck exists for its vehicle today AND `now` is within
   * [scheduledStart − 1h, scheduledStart + 1h]. If either gate fails the driver must
   * supply a `reason` note — that starts the trip anyway, records a TripStartException,
   * and fires a fire-and-forget admin alarm notification. Without a note a blocked
   * start throws TRIP_START_BLOCKED so the driver UI can show why and prompt for one.
   */
  async start(id: string, opts: { reason?: string; actor: ActiveMembership }) {
    // Authorize: only the trip's own crew (driver/conductor) or an admin may start
    // it. A PARENT's scope would otherwise match a trip carrying their child — and
    // the unscoped lookup let any authenticated user start any tenant's trip (IDOR).
    if (opts.actor.role === Role.PARENT) {
      throw new ForbiddenException('Only the trip’s crew or an admin can start a trip.');
    }
    const trip = await this.prisma.trip.findFirst({
      where: { id, ...this.scopeForActor(opts.actor) },
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
        select: { id: true, startedAt: true },
      });
      if (live) {
        // Carry the live trip's id (so the driver app can offer "Resume") and whether
        // it's already Stage-1 overdue (so it can offer "this looks stale — end it"),
        // instead of a dead-end error (PRD-02a §6, Part E).
        const overdueAt = this.stage1OverdueAt(live);
        throw new BadRequestException({
          error: 'TRIP_ALREADY_LIVE',
          message: 'You already have a trip under way. Resume it, or end it, before starting another.',
          liveTripId: live.id,
          liveTripOverdue: !!overdueAt && Date.now() > overdueAt.getTime(),
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

  /**
   * Open lifecycle-alarm feed (PRD-02a §6), scoped to the actor (NFR-05): the
   * started-not-completed trips an admin still needs to act on —
   *  - OVERDUE: a STARTED/IN_PROGRESS trip past its Stage-1 cutoff (still live);
   *  - ABANDONED: a trip the sweep auto-aborted (Stage-2),
   * each with how long it has been running. A trip with an ACKNOWLEDGED audit row is
   * excluded (the admin has already dealt with it). Computed on read, like the
   * never-started feed.
   */
  async listLifecycleAlarms(actor: ActiveMembership) {
    const now = new Date();
    const trips = await this.prisma.trip.findMany({
      where: {
        AND: [
          this.scopeForActor(actor),
          {
            OR: [
              { status: { in: [TripStatus.STARTED, TripStatus.IN_PROGRESS] } },
              {
                status: TripStatus.ABORTED,
                lifecycleEvents: { some: { action: TripLifecycleAction.AUTO_ABORTED } },
              },
            ],
          },
        ],
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
        conductor: true,
        lifecycleEvents: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const result: Array<
      (typeof trips)[number] & {
        lifecycleStage: 'OVERDUE' | 'ABANDONED';
        overdueMinutes: number;
        abortReason: string | null;
      }
    > = [];

    for (const t of trips) {
      // Acknowledged alarms drop out of the open feed.
      if (t.lifecycleEvents.some((e) => e.action === TripLifecycleAction.ACKNOWLEDGED)) continue;
      const runningMinutes = t.startedAt
        ? Math.max(0, Math.round((now.getTime() - t.startedAt.getTime()) / 60_000))
        : 0;

      if (t.status === TripStatus.ABORTED) {
        const autoEvt = t.lifecycleEvents.find(
          (e) => e.action === TripLifecycleAction.AUTO_ABORTED,
        );
        result.push({
          ...t,
          lifecycleStage: 'ABANDONED',
          overdueMinutes: runningMinutes,
          abortReason: autoEvt?.reason ?? null,
        });
        continue;
      }

      const cutoff = this.stage1OverdueAt(t);
      if (cutoff && now.getTime() > cutoff.getTime()) {
        result.push({ ...t, lifecycleStage: 'OVERDUE', overdueMinutes: runningMinutes, abortReason: null });
      }
    }
    return result;
  }

  /**
   * Periodic sweep for started-not-completed trips (PRD-02a §3.2), mirroring the
   * signal-loss @Interval sweep. Runs across every tenant (like that sweep):
   *  - past the Stage-2 cutoff → SYSTEM auto-abort (abandoned), unblocking the driver;
   *  - else past the Stage-1 cutoff → deduped TRIP_OVERDUE alarm to admins (trip stays
   *    live; never auto-completed).
   * Driven by {@link TripOverdueSweepService}. Safe to also compute on read — the Redis
   * dedup means the overdue ping fires at most once per window regardless of trigger.
   */
  async runLifecycleSweep(): Promise<void> {
    const now = Date.now();
    const live = await this.prisma.trip.findMany({
      where: { status: { in: [TripStatus.STARTED, TripStatus.IN_PROGRESS] } },
      select: { id: true, tenantId: true, startedAt: true, route: { select: { name: true } } },
    });

    for (const t of live) {
      const stage2 = this.stage2AbandonedAt(t);
      if (stage2 && now > stage2.getTime()) {
        try {
          await this.performAbort(t.id, {
            reason: 'auto-closed: abandoned (no completion)',
            actor: 'SYSTEM',
            action: TripLifecycleAction.AUTO_ABORTED,
            notifyParentsAndDriver: false,
          });
          await this.notifyAdminsOfAbandoned(t.tenantId, t.id, t.route?.name);
        } catch (err) {
          this.logger.error(`Auto-abort of abandoned trip ${t.id} failed: ${(err as Error).message}`);
        }
        continue;
      }

      const stage1 = this.stage1OverdueAt(t);
      if (stage1 && now > stage1.getTime()) {
        // Don't ping for an alarm an admin already acknowledged.
        const acknowledged = await this.prisma.tripLifecycleEvent.count({
          where: { tripId: t.id, action: TripLifecycleAction.ACKNOWLEDGED },
        });
        if (acknowledged > 0) continue;
        const overdueHours = t.startedAt
          ? Math.floor((now - t.startedAt.getTime()) / (60 * 60_000))
          : 0;
        await this.notifyAdminsOfOverdue(t.tenantId, t.id, t.route?.name, overdueHours).catch((err) =>
          this.logger.error(`TRIP_OVERDUE dispatch failed: ${(err as Error).message}`),
        );
      }
    }
  }

  /** Resolve tenant admins once and dispatch a deduped TRIP_OVERDUE for one live trip. */
  private async notifyAdminsOfOverdue(
    tenantId: string,
    tripId: string,
    routeName: string | undefined,
    overdueHours: number,
  ) {
    const recipientIds = await this.tenantAdminIds(tenantId);
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.TRIP_OVERDUE,
      tenantId,
      recipientIds,
      variables: {
        tripId,
        routeName: routeName ?? 'A trip',
        overdueHours: String(overdueHours),
        deepLink: '/trips/exceptions',
      },
      entityId: tripId,
    });
  }

  /** Resolve tenant admins once and dispatch a deduped TRIP_ABANDONED for an auto-aborted trip. */
  private async notifyAdminsOfAbandoned(
    tenantId: string,
    tripId: string,
    routeName: string | undefined,
  ) {
    const recipientIds = await this.tenantAdminIds(tenantId);
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.TRIP_ABANDONED,
      tenantId,
      recipientIds,
      variables: { tripId, routeName: routeName ?? 'A trip', deepLink: '/trips/exceptions' },
      entityId: tripId,
    });
  }

  /** ACTIVE admin / transport-manager person ids for a tenant (notification recipients). */
  private async tenantAdminIds(tenantId: string): Promise<string[]> {
    const admins = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never }, status: 'ACTIVE' },
      select: { personId: true },
    });
    return [...new Set(admins.map((a) => a.personId))];
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
  async complete(id: string, opts: { reason?: string; stoppedAtSeq?: number; actor: ActiveMembership }) {
    // Authorize identically to start(): trip crew or admin only, tenant-scoped.
    if (opts.actor.role === Role.PARENT) {
      throw new ForbiddenException('Only the trip’s crew or an admin can complete a trip.');
    }
    const trip = await this.prisma.trip.findFirst({
      where: { id, ...this.scopeForActor(opts.actor) },
      select: { id: true, tenantId: true, status: true, startedAt: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    // §1 — a trip must be under way before it can be completed.
    if (trip.status !== TripStatus.STARTED && trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException({
        error: 'TRIP_NOT_STARTED',
        message: `Cannot complete a trip that is ${trip.status.toLowerCase()} — start it first.`,
      });
    }

    // Completion-window guard (PRD-02a §4): a trip started beyond the Stage-2 cutoff
    // is too old to be closed normally — it should be auto-/admin-aborted, not
    // back-dated to "completed" a day later (the record-corruption / driver-exploit
    // hole). Admin force-complete deliberately bypasses this (it is the override).
    const stage2 = this.stage2AbandonedAt(trip);
    if (stage2 && Date.now() > stage2.getTime()) {
      throw new BadRequestException({
        error: 'TRIP_COMPLETION_WINDOW_EXPIRED',
        message:
          'This trip is too old to complete — it needs admin review (force-complete or abort).',
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

  /**
   * Abort a trip already under way (mid-route emergency stop, or an admin force-abort
   * of a stuck trip). A reason is MANDATORY (PRD-02a §4): the actor + reason + timestamp
   * are written to the immutable lifecycle audit, the affected riders' EXPECTED/
   * NOT_BOARDED roster flags are cleared so an aborted trip stops generating
   * not-boarded anomalies (FR-19/FR-22), and the affected parents + driver are
   * notified (mirrors the cancellation path, FR-22). Tenant-scoped (NFR-05).
   */
  async abort(id: string, opts: { reason: string; actorId: string; tenantId: string }) {
    const reason = opts.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        error: 'TRIP_ABORT_REASON_REQUIRED',
        message: 'A reason is required to abort a trip.',
      });
    }
    await this.assertOwned(id, opts.tenantId);
    return this.performAbort(id, {
      reason,
      actor: opts.actorId,
      action: TripLifecycleAction.FORCE_ABORTED,
      notifyParentsAndDriver: TripsService.NOTIFY_PARENTS_ON_ABORT,
    });
  }

  /**
   * Shared ABORTED transition (PRD-02a §4/§5). Used by the manual/admin abort and the
   * Stage-2 SYSTEM auto-abort. Transitions to ABORTED, clears the affected riders'
   * roster flags, and writes the immutable audit row. Parent/driver notification is
   * the caller's choice (manual abort notifies them; the abandoned auto-abort instead
   * fires the admin-targeted TRIP_ABANDONED alarm).
   */
  private async performAbort(
    id: string,
    opts: {
      reason: string;
      actor: string;
      action: TripLifecycleAction;
      notifyParentsAndDriver: boolean;
    },
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    const updated = await this.transition(id, TripStatus.ABORTED, { completedAt: new Date() });

    // Clear the affected riders so an aborted trip can't keep flagging "not boarded".
    await this.prisma.tripRider.updateMany({
      where: { tripId: id, boardStatus: { in: [RiderStatus.EXPECTED, RiderStatus.NOT_BOARDED] } },
      data: { boardStatus: RiderStatus.CANCELLED },
    });

    await this.writeLifecycleEvent(trip.tenantId, id, opts.action, opts.actor, opts.reason);

    if (opts.notifyParentsAndDriver) {
      this.notifyPickupCancelled(id, undefined, { includeGuardians: true }).catch((err) =>
        this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
      );
    }
    return updated;
  }

  /**
   * Admin force-complete (PRD-02a §4/§6): close a trip the driver ran but forgot to
   * complete. Records who/why in the audit. Deliberately bypasses the completion-window
   * guard — this IS the override for a trip too old to self-complete. A reason is
   * mandatory. Tenant-scoped (NFR-05).
   */
  async forceComplete(id: string, tenantId: string, actorId: string, reason: string) {
    const note = reason?.trim();
    if (!note) {
      throw new BadRequestException({
        error: 'TRIP_FORCE_COMPLETE_REASON_REQUIRED',
        message: 'A reason is required to force-complete a trip.',
      });
    }
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId },
      select: { id: true, tenantId: true, status: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    if (trip.status !== TripStatus.STARTED && trip.status !== TripStatus.IN_PROGRESS) {
      throw new BadRequestException({
        error: 'TRIP_NOT_LIVE',
        message: `Only a live trip can be force-completed — this trip is ${trip.status.toLowerCase()}.`,
      });
    }

    const updated = await this.transition(id, TripStatus.COMPLETED, { completedAt: new Date() });
    await this.writeLifecycleEvent(trip.tenantId, id, TripLifecycleAction.FORCE_COMPLETED, actorId, note);
    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_END).catch((err) =>
      this.logger.error(`TRIP_END dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /**
   * Acknowledge an overdue / auto-aborted lifecycle alarm (PRD-02a §5/§6): records an
   * ACKNOWLEDGED audit row with the admin's note, which removes the trip from the open
   * lifecycle-alarm feed. No state change. Tenant-scoped (NFR-05).
   */
  async acknowledgeLifecycle(id: string, tenantId: string, actorId: string, note?: string) {
    await this.assertOwned(id, tenantId);
    return this.writeLifecycleEvent(
      tenantId,
      id,
      TripLifecycleAction.ACKNOWLEDGED,
      actorId,
      note?.trim() || null,
    );
  }

  /** Resolve every guardian of every rider on the trip and dispatch a trip-lifecycle event. */
  private async notifyGuardiansOnTrip(tripId: string, eventType: NotifCategory) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        tenantId: true,
        direction: true,
        anchorLabel: true,
        route: { select: { name: true } },
        tenant: { select: { schoolName: true } },
      },
    });
    if (!trip) return;
    // School-aware copy (drop start / pickup end): prefer the per-trip destination
    // override label, else the tenant's school name. Absent → the template falls
    // back to a generic "the school" (never renders "undefined").
    const schoolName = trip.anchorLabel ?? trip.tenant?.schoolName ?? undefined;
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
    // Trip-wide fan-out: a single child name can't apply (the trip carries many),
    // so identify the trip by its route + direction instead of a vague "the bus".
    await this.notifications.dispatch({
      eventType,
      tenantId: trip.tenantId,
      recipientIds,
      variables: {
        tripId,
        ...(trip.route?.name ? { routeName: trip.route.name } : {}),
        ...(schoolName ? { schoolName } : {}),
        direction: trip.direction,
        deepLink: `/track/${tripId}`,
      },
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
    opts: { includeGuardians?: boolean } = {},
  ) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { tenantId: true, vehicleId: true, direction: true, route: { select: { name: true } } },
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
    // Whole-trip abort (PRD-02a §3.3 / FR-22): also notify the affected parents —
    // the guardians of every rider still on the trip.
    if (opts.includeGuardians) {
      const riders = await this.prisma.tripRider.findMany({
        where: { tripId },
        select: { studentId: true },
      });
      if (riders.length) {
        const guardians = await this.prisma.guardianship.findMany({
          where: { studentId: { in: riders.map((r) => r.studentId) } },
          select: { personId: true },
        });
        for (const g of guardians) recipientIds.add(g.personId);
      }
    }
    if (!recipientIds.size) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.PICKUP_CANCELLED,
      tenantId: trip.tenantId,
      recipientIds: [...recipientIds],
      variables: {
        tripId,
        ...(student ? { studentName: student.studentName } : {}),
        ...(trip.route?.name ? { routeName: trip.route.name } : {}),
        direction: trip.direction,
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
      select: { tenantId: true, status: true, scheduledStart: true, date: true, direction: true },
    });

    // A DROP can never be skipped: skipping a pickup just means "don't collect my
    // child this morning", but a child already at school still needs to get home.
    // (Only pickups are skippable — see pickupCancelInfo in the api-client.)
    if (trip.direction === Direction.DROP) {
      throw new BadRequestException('A drop cannot be skipped — your child still needs to get home');
    }

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
    /** Shift (AgeGroup) to schedule for — derives scheduledStart + filters the roster. */
    shiftId?: string;
    /** Per-trip school-end override (different-destination run). lat + lng together. */
    anchorLat?: number;
    anchorLng?: number;
    anchorLabel?: string;
  }) {
    const { tenantId, routeId, vehicleId, driverId, conductorId, date, direction, shiftId } = data;

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

    // Shift-aware scheduling (optional): verify the shift belongs to this school
    // (NFR-05, mirrors the route/vehicle checks) before it can drive scheduledStart
    // or filter the roster. A plain whole-route trip leaves shiftId null.
    let shift: { id: string; pickupTime: string; dropTime: string } | null = null;
    if (shiftId) {
      shift = await this.prisma.ageGroup.findFirst({
        where: { id: shiftId, tenantId },
        select: { id: true, pickupTime: true, dropTime: true },
      });
      if (!shift) throw new BadRequestException('Shift not found in this school');
    }

    // Per-trip school-end override — all-or-none (rejects a half-set anchor).
    const anchor = normaliseAnchorOverride(data);

    // Roster = ACTIVE students on this route that have a boarding stop, FILTERED to
    // the shift's students (Student.ageGroupId === shiftId) when shift-aware. A
    // stop-less student can't be placed in the "expected at stop X" roster.
    const students = await this.prisma.student.findMany({
      where: { tenantId, routeId, status: 'ACTIVE', stopId: { not: null }, ...(shiftId ? { ageGroupId: shiftId } : {}) },
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
          : shiftId
            ? 'No active students on this route belong to that shift — assign students to this shift, with a stop on this route, before scheduling.'
            : 'This route has no eligible riders — assign active students to a stop on this route before scheduling.',
      );
    }

    // Planned departure: admin-entered if supplied; else the shift's pickup/drop
    // time applied to the trip day when shift-aware; else the route's age-group
    // time (existing behaviour). (2B trip-start governance window.)
    const scheduledStart =
      data.scheduledStart ??
      (shift ? applyHHMMToDate(direction === Direction.PICKUP ? shift.pickupTime : shift.dropTime, date) : null) ??
      (await this.deriveScheduledStart(routeId, tenantId, date, direction));

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
          shiftId: shiftId ?? null,
          date,
          direction,
          scheduledStart,
          anchorLat: anchor?.lat ?? null,
          anchorLng: anchor?.lng ?? null,
          anchorLabel: anchor?.label ?? null,
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
      /** A non-empty id assigns the shift; an empty string clears it. */
      shiftId?: string | null;
    },
  ) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, routeId: true, shiftId: true },
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
    // A (re)assigned shift must belong to this school (NFR-05). An empty string
    // clears it; only a non-empty id is verified.
    if (patch.shiftId) {
      const shift = await this.prisma.ageGroup.findFirst({
        where: { id: patch.shiftId, tenantId },
        select: { id: true },
      });
      if (!shift) throw new BadRequestException('Shift not found in this school');
    }

    const routeChanged = !!patch.routeId && patch.routeId !== trip.routeId;
    const newRouteId = patch.routeId ?? trip.routeId;
    // Effective shift after this edit (empty string clears it), and whether it changed.
    const newShiftId = patch.shiftId !== undefined ? patch.shiftId || null : trip.shiftId;
    const shiftChanged = patch.shiftId !== undefined && newShiftId !== trip.shiftId;
    // The roster depends on both route and shift, so it's stale if either changed.
    const rosterStale = routeChanged || shiftChanged;
    const shiftFilter = newShiftId ? { ageGroupId: newShiftId } : {};

    // Re-routing/re-shifting onto an empty roster would leave the trip with no
    // riders — block it (a driver can't be assigned an empty trip). Only enforced
    // when the roster actually changes, so editing time/driver is never blocked.
    if (rosterStale) {
      const eligible = await this.prisma.student.count({
        where: { tenantId, routeId: newRouteId, status: 'ACTIVE', stopId: { not: null }, ...shiftFilter },
      });
      if (eligible === 0) {
        throw new BadRequestException(
          newShiftId
            ? 'No active students on this route belong to that shift — pick a different shift/route or assign students first.'
            : 'This route has no eligible riders — assign active students to a stop on it before assigning a trip to it.',
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
    if (patch.shiftId !== undefined) data.shiftId = newShiftId;

    return this.prisma.$transaction(async (tx) => {
      if (rosterStale) {
        // Rebuild the roster for the new route/shift — old riders no longer apply.
        await tx.tripRider.deleteMany({ where: { tripId: id } });
        const students = await tx.student.findMany({
          where: { tenantId, routeId: newRouteId, status: 'ACTIVE', stopId: { not: null }, ...shiftFilter },
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
