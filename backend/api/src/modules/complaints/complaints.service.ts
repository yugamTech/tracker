import { Injectable, Logger } from '@nestjs/common';
import { NotifCategory } from '@saarthi/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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

  findById(id: string) {
    return this.prisma.complaint.findUniqueOrThrow({
      where: { id },
      include: {
        events: { orderBy: { ts: 'asc' } },
        attachments: true,
        student: true,
        trip: { include: { route: true } },
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
      where.createdAt = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
      };
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
