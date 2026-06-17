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

  /**
   * Deactivate a vehicle — SOFT delete only: flips status to INACTIVE so it drops
   * off the active fleet and can be filtered out, while its record and assignment
   * history are preserved. Never a hard delete. Tenant-scoped (NFR-05).
   */
  async deactivate(id: string, tenantId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return this.prisma.vehicle.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: {
        assignments: {
          include: { membership: { include: { person: true } } },
        },
      },
    });
  }

  /**
   * Reactivate a vehicle — the inverse of deactivate(): flips status back to
   * ACTIVE so it rejoins the active fleet and can be scheduled again. Its record
   * and assignment history are untouched. Tenant-scoped (NFR-05).
   */
  async reactivate(id: string, tenantId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return this.prisma.vehicle.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: {
        assignments: {
          include: { membership: { include: { person: true } } },
        },
      },
    });
  }
}
