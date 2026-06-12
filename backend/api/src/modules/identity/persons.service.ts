import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.person.findUniqueOrThrow({ where: { id } });
  }

  findByPhone(phone: string) {
    return this.prisma.person.findUnique({ where: { phone } });
  }

  list(tenantId: string) {
    return this.prisma.person.findMany({
      where: { memberships: { some: { tenantId } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
