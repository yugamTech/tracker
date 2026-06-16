import { Injectable, NotFoundException } from '@nestjs/common';
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

  // Tenant-scoped read (NFR-05): a vehicle id from another school must 404.
  async findById(id: string, tenantId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
      include: {
        assignments: {
          include: { membership: { include: { person: true } } },
        },
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return vehicle;
  }

  create(data: { tenantId: string; regNumber: string; capacity: number; type?: string }) {
    return this.prisma.vehicle.create({ data });
  }

  async update(id: string, tenantId: string, data: Partial<{ regNumber: string; capacity: number; type: string; status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' }>) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return this.prisma.vehicle.update({ where: { id }, data });
  }
}
