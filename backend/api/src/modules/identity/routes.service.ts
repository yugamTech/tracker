import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.route.findMany({
      where: { tenantId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Tenant-scoped read (NFR-05): a route id alone is not enough — it must belong
  // to the caller's tenant or it 404s, so an admin can never read another
  // school's route (and, via the include, its students).
  async findById(id: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, tenantId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        students: { include: { ageGroup: true, stop: true } },
      },
    });
    if (!route) throw new NotFoundException(`Route ${id} not found`);
    return route;
  }

  create(data: { tenantId: string; name: string; direction: 'PICKUP' | 'DROP' }) {
    return this.prisma.route.create({ data });
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; status: 'ACTIVE' | 'INACTIVE' }>) {
    await this.assertOwned(id, tenantId);
    return this.prisma.route.update({ where: { id }, data });
  }

  async addStop(tenantId: string, data: { routeId: string; stopId: string; sequence: number }) {
    await this.assertOwned(data.routeId, tenantId);
    // The stop must also belong to this tenant — otherwise an admin could pin
    // another school's stop onto their route.
    const stop = await this.prisma.stop.findFirst({ where: { id: data.stopId, tenantId }, select: { id: true } });
    if (!stop) throw new NotFoundException(`Stop ${data.stopId} not found`);
    return this.prisma.routeStop.create({ data });
  }

  async removeStop(routeId: string, tenantId: string, stopId: string) {
    await this.assertOwned(routeId, tenantId);
    return this.prisma.routeStop.deleteMany({ where: { routeId, stopId } });
  }

  private async assertOwned(routeId: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
  }
}
