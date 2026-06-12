import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.student.findMany({
      where: { tenantId },
      include: {
        ageGroup: true,
        route: true,
        stop: true,
        guardianships: { include: { person: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.student.findUniqueOrThrow({
      where: { id },
      include: {
        ageGroup: true,
        route: true,
        stop: true,
        guardianships: { include: { person: true } },
      },
    });
  }

  create(data: {
    tenantId: string;
    name: string;
    regId?: string;
    ageGroupId: string;
    routeId?: string;
    stopId?: string;
  }) {
    return this.prisma.student.create({ data });
  }

  update(id: string, data: Partial<{ name: string; routeId: string; stopId: string; status: 'ACTIVE' | 'INACTIVE' }>) {
    return this.prisma.student.update({ where: { id }, data });
  }

  getByGuardian(personId: string) {
    return this.prisma.student.findMany({
      where: { guardianships: { some: { personId } } },
      include: { route: true, stop: true, ageGroup: true },
    });
  }
}
