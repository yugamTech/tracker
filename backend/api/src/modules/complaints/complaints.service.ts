import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotifCategory, ComplaintStatus, canTransitionComplaint } from '@yaanam/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** `YYYY-MM-DD` → local-time start of that calendar day (00:00:00.000). */
function startOfLocalDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/** `YYYY-MM-DD` → local-time end of that calendar day (23:59:59.999). */
function endOfLocalDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
}

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  create(data: {
    tenantId: string;
    raisedBy: string;
    studentId?: string;
    tripId?: string;
    category: string;
    description?: string;
  }) {
    return this.prisma.complaint.create({ data });
  }

  async findById(id: string, tenantId: string) {
    // Tenant-scoped read: a complaint id from another tenant must 404, never leak
    // its trip/driver/roster context. `findFirstOrThrow` lets us AND `tenantId`
    // onto the lookup (a `findUnique` where can't take non-unique fields).
    const complaint = await this.prisma.complaint.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        events: { orderBy: { ts: 'asc' } },
        attachments: true,
        student: true,
        // `raiser` = the guardian who filed it: name + phone power the admin
        // "who raised it" line (raisedBy was never joined before).
        raiser: { select: { id: true, name: true, phone: true } },
        // The parent's satisfaction step — surfaced to the admin before closing.
        resolutionRating: true,
        // `driver` powers the admin "who ran this trip" line + Open-trip jump.
        trip: { include: { route: true, driver: true } },
      },
    });
    // Resolve each event's actor personId → display name in one query, so both
    // the admin event log and the parent timeline can show WHO acted ("Resolved
    // by X"). actor is a personId for every complaint event.
    const actorIds = [...new Set(complaint.events.map((e) => e.actor))];
    const persons = actorIds.length
      ? await this.prisma.person.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(persons.map((p) => [p.id, p.name]));
    return {
      ...complaint,
      events: complaint.events.map((e) => ({ ...e, actorName: nameById.get(e.actor) ?? null })),
    };
  }

  listByRaiser(raisedBy: string) {
    return this.prisma.complaint.findMany({
      where: { raisedBy },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      category?: string;
      routeId?: string;
      driverId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.category) where.category = filters.category;
    if (filters?.routeId) where.trip = { routeId: filters.routeId };
    if (filters?.driverId) {
      where.trip = { ...(where.trip ?? {}), driverId: filters.driverId };
    }
    if (filters?.dateFrom || filters?.dateTo) {
      // Parse `YYYY-MM-DD` as a whole local calendar day: `from` from its start,
      // `to` through its end, so a single-day range still matches that day's rows.
      const gte = filters.dateFrom ? startOfLocalDay(filters.dateFrom) : undefined;
      const lte = filters.dateTo ? endOfLocalDay(filters.dateTo) : undefined;
      if (gte && lte && gte > lte) {
        throw new BadRequestException('dateFrom must not be after dateTo');
      }
      where.createdAt = { ...(gte && { gte }), ...(lte && { lte }) };
    }
    return this.prisma.complaint.findMany({
      where,
      include: {
        student: true,
        // Join the raiser so the admin queue shows WHO raised each complaint.
        raiser: { select: { id: true, name: true, phone: true } },
        trip: { include: { route: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Service KPIs for the admin Complaints → KPIs screen. Computed live from the
   * complaint rows (volumes are modest; mirrors the in-JS aggregation style of
   * TripsService.getDriverHistory rather than a raw-SQL rollup).
   *
   * Buckets (by lifecycle position):
   *  - open            = in-flight (RECEIVED/IN_PROGRESS/COUNSELLING_CALL/ADMIN_CALL/VISIT/REOPENED)
   *  - awaitingClosure = resolution delivered, not yet closed (RESOLVED/PARENT_RATING)
   *  - closed          = CLOSED
   *
   * NOTE: as real complaint data lands the schema may evolve (e.g. severity-weighted
   * SLA, per-category targets); this rollup is intentionally simple and additive.
   */
  async kpi(tenantId: string) {
    const complaints = await this.prisma.complaint.findMany({
      where: { tenantId },
      select: {
        status: true,
        category: true,
        createdAt: true,
        resolvedAt: true,
        trip: {
          select: {
            routeId: true,
            route: { select: { name: true } },
            driverId: true,
            driver: { select: { name: true } },
          },
        },
        resolutionRating: { select: { rating: true, satisfied: true } },
      },
    });

    const total = complaints.length;

    const OPEN = new Set<string>([
      ComplaintStatus.RECEIVED,
      ComplaintStatus.IN_PROGRESS,
      ComplaintStatus.COUNSELLING_CALL,
      ComplaintStatus.ADMIN_CALL,
      ComplaintStatus.VISIT,
      ComplaintStatus.REOPENED,
    ]);
    const AWAITING = new Set<string>([ComplaintStatus.RESOLVED, ComplaintStatus.PARENT_RATING]);

    let open = 0;
    let awaitingClosure = 0;
    let closed = 0;

    // Breakdowns keyed by id; value carries a display name + running count.
    const byStatus = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byRoute = new Map<string, { routeId: string | null; routeName: string; count: number }>();
    const byDriver = new Map<string, { driverId: string | null; driverName: string; count: number }>();

    let resolutionMsSum = 0;
    let resolvedWithTime = 0;

    let ratingCount = 0;
    let ratingSum = 0;
    let satisfiedCount = 0;

    for (const c of complaints) {
      if (c.status === ComplaintStatus.CLOSED) closed += 1;
      else if (AWAITING.has(c.status)) awaitingClosure += 1;
      else if (OPEN.has(c.status)) open += 1;

      byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
      byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);

      const routeKey = c.trip?.routeId ?? '__none__';
      const routeName = c.trip?.route?.name ?? 'Unlinked';
      const route = byRoute.get(routeKey) ?? { routeId: c.trip?.routeId ?? null, routeName, count: 0 };
      route.count += 1;
      byRoute.set(routeKey, route);

      const driverKey = c.trip?.driverId ?? '__none__';
      const driverName = c.trip?.driver?.name ?? 'Unassigned';
      const driver = byDriver.get(driverKey) ?? { driverId: c.trip?.driverId ?? null, driverName, count: 0 };
      driver.count += 1;
      byDriver.set(driverKey, driver);

      if (c.resolvedAt) {
        resolutionMsSum += c.resolvedAt.getTime() - c.createdAt.getTime();
        resolvedWithTime += 1;
      }

      if (c.resolutionRating) {
        ratingCount += 1;
        ratingSum += c.resolutionRating.rating;
        if (c.resolutionRating.satisfied) satisfiedCount += 1;
      }
    }

    const toSortedArray = <T>(m: Map<string, T>, count: (t: T) => number) =>
      [...m.values()].sort((a, b) => count(b) - count(a));

    return {
      total,
      open,
      awaitingClosure,
      closed,
      resolutionRate: total > 0 ? closed / total : null,
      avgResolutionHours:
        resolvedWithTime > 0 ? resolutionMsSum / resolvedWithTime / 3_600_000 : null,
      byStatus: [...byStatus.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      byCategory: [...byCategory.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      byRoute: toSortedArray(byRoute, (r) => r.count),
      byDriver: toSortedArray(byDriver, (d) => d.count),
      rating: {
        count: ratingCount,
        avg: ratingCount > 0 ? ratingSum / ratingCount : null,
        satisfiedRate: ratingCount > 0 ? satisfiedCount / ratingCount : null,
      },
    };
  }

  /**
   * Admin/manager status change. Enforces the validated lifecycle (previously any
   * string was accepted) and the close gate, then appends the ComplaintEvent audit
   * row and notifies the parent.
   *
   * Close gate (FR): a complaint may move to CLOSED only after the parent has
   * responded to the resolution (a ResolutionRating exists) OR with an explicit
   * `override`, which is recorded on the audit trail so it is never silent.
   */
  async updateStatus(
    id: string,
    tenantId: string,
    toStatus: string,
    actor: string,
    note?: string,
    override = false,
  ) {
    // Tenant-scoped lookup — an admin must never drive another tenant's complaint
    // (and fire its parent notifications) by id. Mirrors `findById(id, tenantId)`.
    const complaint = await this.prisma.complaint.findFirstOrThrow({ where: { id, tenantId } });
    const from = complaint.status as ComplaintStatus;
    const to = toStatus as ComplaintStatus;

    if (!Object.values(ComplaintStatus).includes(to)) {
      throw new BadRequestException(`Unknown complaint status: ${toStatus}`);
    }
    if (from === to) {
      throw new BadRequestException(`Complaint is already ${from}.`);
    }
    if (!canTransitionComplaint(from, to)) {
      throw new BadRequestException(`Illegal status transition: ${from} → ${to}.`);
    }

    // Close gate + override recording.
    let auditNote = note;
    if (to === ComplaintStatus.CLOSED) {
      const rating = await this.prisma.resolutionRating.findUnique({
        where: { complaintId: id },
      });
      if (!rating) {
        if (!override) {
          throw new BadRequestException(
            'Cannot close: the parent has not responded to the resolution yet. ' +
              'Close with an explicit override to proceed without their feedback.',
          );
        }
        auditNote = `[Closed without parent feedback — admin override]${note ? ` ${note}` : ''}`;
      }
    }

    // Resolve the actor's display name for the parent-facing notification.
    const actorPerson = await this.prisma.person.findUnique({
      where: { id: actor },
      select: { name: true },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.complaint.update({
        where: { id },
        data: {
          status: to as never,
          // Stamp resolvedAt the first time it reaches RESOLVED (field existed but was unused).
          ...(to === ComplaintStatus.RESOLVED && { resolvedAt: new Date() }),
        },
      }),
      this.prisma.complaintEvent.create({
        data: {
          complaintId: id,
          actor,
          fromStatus: from as never,
          toStatus: to as never,
          note: auditNote,
        },
      }),
    ]);
    // Fire-and-forget: notify the guardian who filed the complaint of the new
    // status — including WHO acted (resolverName) so the parent sees who handled it.
    if (complaint.raisedBy) {
      this.notifications
        .dispatch({
          eventType: NotifCategory.COMPLAINT_UPDATE,
          tenantId: complaint.tenantId,
          recipientIds: [complaint.raisedBy],
          variables: {
            status: toStatus,
            complaintId: id,
            deepLink: `/complaints/${id}`,
            ...(actorPerson?.name && { resolverName: actorPerson.name }),
            ...(note && { note }),
          },
          entityId: id,
        })
        .catch((err) =>
          this.logger.error(`COMPLAINT_UPDATE dispatch failed: ${(err as Error).message}`),
        );
    }
    return updated;
  }
}
