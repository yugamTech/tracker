import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class StopsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.stop.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  // Tenant-scoped read (NFR-05): a stop id from another school must 404.
  async findById(id: string, tenantId: string) {
    const stop = await this.prisma.stop.findFirst({ where: { id, tenantId } });
    if (!stop) throw new NotFoundException(`Stop ${id} not found`);
    return stop;
  }

  create(data: { tenantId: string; name: string; lat: number; lng: number; geofenceRadius?: number }) {
    return this.prisma.stop.create({ data });
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; lat: number; lng: number; geofenceRadius: number }>) {
    const stop = await this.prisma.stop.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!stop) throw new NotFoundException(`Stop ${id} not found`);
    return this.prisma.stop.update({ where: { id }, data });
  }
}
