import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId },
      include: {
        assignments: {
          where: { effectiveTo: null },
          include: { membership: { include: { person: true } } },
        },
      },
      orderBy: { regNumber: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.vehicle.findUniqueOrThrow({
      where: { id },
      include: {
        assignments: {
          include: { membership: { include: { person: true } } },
        },
      },
    });
  }

  create(data: { tenantId: string; regNumber: string; capacity: number; type?: string }) {
    return this.prisma.vehicle.create({ data });
  }

  update(id: string, data: Partial<{ regNumber: string; capacity: number; type: string; status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' }>) {
    return this.prisma.vehicle.update({ where: { id }, data });
  }
}
