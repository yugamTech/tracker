import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotifCategory } from '@saarthi/types';
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

  findById(id: string, tenantId: string) {
    // Tenant-scoped read: a complaint id from another tenant must 404, never leak
    // its trip/driver/roster context. `findFirstOrThrow` lets us AND `tenantId`
    // onto the lookup (a `findUnique` where can't take non-unique fields).
    return this.prisma.complaint.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        events: { orderBy: { ts: 'asc' } },
        attachments: true,
        student: true,
        // `driver` powers the admin "who ran this trip" line + Open-trip jump.
        trip: { include: { route: true, driver: true } },
      },
    });
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
      include: { student: true, trip: { include: { route: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, toStatus: string, actor: string, note?: string) {
    const complaint = await this.prisma.complaint.findUniqueOrThrow({ where: { id } });
    const [updated] = await this.prisma.$transaction([
      this.prisma.complaint.update({ where: { id }, data: { status: toStatus as never } }),
      this.prisma.complaintEvent.create({
        data: {
          complaintId: id,
          actor,
          fromStatus: complaint.status,
          toStatus: toStatus as never,
          note,
        },
      }),
    ]);
    // Fire-and-forget: notify the guardian who filed the complaint of the new status.
    if (complaint.raisedBy) {
      this.notifications
        .dispatch({
          eventType: NotifCategory.COMPLAINT_UPDATE,
          tenantId: complaint.tenantId,
          recipientIds: [complaint.raisedBy],
          variables: { status: toStatus, complaintId: id, deepLink: `/complaints/${id}`, ...(note && { note }) },
          entityId: id,
        })
        .catch((err) =>
          this.logger.error(`COMPLAINT_UPDATE dispatch failed: ${(err as Error).message}`),
        );
    }
    return updated;
  }
}
