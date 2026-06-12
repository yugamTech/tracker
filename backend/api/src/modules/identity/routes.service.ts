import { Injectable } from '@nestjs/common';
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

  findById(id: string) {
    return this.prisma.route.findUniqueOrThrow({
      where: { id },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        students: { include: { ageGroup: true, stop: true } },
      },
    });
  }

  create(data: { tenantId: string; name: string; direction: 'PICKUP' | 'DROP' }) {
    return this.prisma.route.create({ data });
  }

  update(id: string, data: Partial<{ name: string; status: 'ACTIVE' | 'INACTIVE' }>) {
    return this.prisma.route.update({ where: { id }, data });
  }

  addStop(data: { routeId: string; stopId: string; sequence: number }) {
    return this.prisma.routeStop.create({ data });
  }

  removeStop(routeId: string, stopId: string) {
    return this.prisma.routeStop.deleteMany({ where: { routeId, stopId } });
  }
}
