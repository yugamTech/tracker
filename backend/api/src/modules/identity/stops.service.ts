import { Injectable } from '@nestjs/common';
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

  findById(id: string) {
    return this.prisma.stop.findUniqueOrThrow({ where: { id } });
  }

  create(data: { tenantId: string; name: string; lat: number; lng: number; geofenceRadius?: number }) {
    return this.prisma.stop.create({ data });
  }

  update(id: string, data: Partial<{ name: string; lat: number; lng: number; geofenceRadius: number }>) {
    return this.prisma.stop.update({ where: { id }, data });
  }
}
