import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class AgeGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.ageGroup.findMany({
      where: { tenantId },
      include: { _count: { select: { students: true } } },
      orderBy: { name: 'asc' },
    });
  }

  create(data: { tenantId: string; name: string; pickupTime: string; dropTime: string; routeId?: string }) {
    return this.prisma.ageGroup.create({ data });
  }
}
