import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, data: Partial<{ name: string; timezone: string; locale: string; featureFlags: object }>) {
    return this.prisma.tenant.update({ where: { id }, data });
  }
}
