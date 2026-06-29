import { Injectable, NotFoundException } from '@nestjs/common';
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
  async getById(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { payments: true, receipt: true },
    });
    // findFirst (not ...OrThrow): a cross-tenant/missing id must yield a clean 404,
    // not the raw Prisma P2025 error that ...OrThrow would surface as a 500.
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  getByStudent(studentId: string) {
    return this.prisma.invoice.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' },
    });
  }
}
