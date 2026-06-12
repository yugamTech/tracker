import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import type { Role } from '@saarthi/types';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, role?: string) {
    return this.prisma.membership.findMany({
      where: { tenantId, status: 'ACTIVE', ...(role ? { role: role as Role } : {}) },
      include: { person: true },
      orderBy: { person: { name: 'asc' } },
    });
  }

  findById(id: string) {
    return this.prisma.membership.findUniqueOrThrow({
      where: { id },
      include: { person: true, vehicleAssignments: { include: { vehicle: true } } },
    });
  }
}
