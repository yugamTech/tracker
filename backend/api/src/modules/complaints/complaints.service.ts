import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return updated;
  }
}
