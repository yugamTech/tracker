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

  // Tenant-scoped by design: an invoice id alone must never resolve across
  // tenants. (Per-parent scoping — restricting a guardian to their own children's
  // invoices — lands with the payments build, which replaces the tenant-wide list.)
  getById(id: string, tenantId: string) {
    return this.prisma.invoice.findFirstOrThrow({
      where: { id, tenantId },
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
