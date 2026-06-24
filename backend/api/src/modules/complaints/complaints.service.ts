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
    toStatus: string,
    actor: string,
    note?: string,
    override = false,
  ) {
    const complaint = await this.prisma.complaint.findUniqueOrThrow({ where: { id } });
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
