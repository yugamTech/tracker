import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  getByTenant(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getById(id: string) {
    return this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { payments: true, receipt: true },
    });
  }

  getByStudent(studentId: string) {
    return this.prisma.invoice.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' },
    });
  }
}
