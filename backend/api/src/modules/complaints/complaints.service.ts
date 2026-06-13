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
      include: { events: true, attachments: true, student: true, trip: true },
    });
  }

  listByRaiser(raisedBy: string) {
    return this.prisma.complaint.findMany({
      where: { raisedBy },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByTenant(tenantId: string, status?: string) {
    return this.prisma.complaint.findMany({
      where: { tenantId, ...(status && { status: status as never }) },
      include: { student: true },
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
          variables: { status: toStatus, complaintId: id, deepLink: `/complaints/${id}` },
          entityId: id,
        })
        .catch((err) =>
          this.logger.error(`COMPLAINT_UPDATE dispatch failed: ${(err as Error).message}`),
        );
    }
    return updated;
  }
}
