import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class DailyChecksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a driver's daily vehicle check. submittedById comes from the JWT. */
  create(data: {
    tenantId: string;
    vehicleId: string;
    submittedById: string;
    tripId?: string;
    items: Record<string, boolean>;
    note?: string;
  }) {
    return this.prisma.dailyCheck.create({ data });
  }

  /** List checks for a tenant, optionally narrowed to a vehicle and/or a day. */
  list(tenantId: string, filters: { vehicleId?: string; date?: Date }) {
    const where: Prisma.DailyCheckWhereInput = { tenantId };
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }
    return this.prisma.dailyCheck.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
