import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

/**
 * Coerce a user-entered number into the `+91XXXXXXXXXX` E.164 form the parent
 * app uses at login. Identity is keyed by this exact string, so admin-created
 * parents must match what the parent types (10 digits) or they can never log in.
 */
function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (input.trim().startsWith('+')) return `+${digits}`;
  return `+91${digits}`;
}

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

  /**
   * Create a student and, when parent details are supplied, link the family in
   * one transaction: upsert the parent Person (global identity, keyed by phone),
   * grant an ACTIVE PARENT membership in this tenant, and create the guardianship.
   * Without this linkage an admin-added student is an orphan no parent can ever see.
   */
  async create(data: {
    tenantId: string;
    name: string;
    regId?: string;
    ageGroupId: string;
    routeId?: string;
    stopId?: string;
    parentName?: string;
    parentPhone?: string;
    relation?: string;
  }) {
    const { parentName, parentPhone, relation, ...studentData } = data;

    // No parent details → plain student create (kept for back-compat / bulk paths).
    if (!parentPhone) {
      return this.prisma.student.create({ data: studentData });
    }

    const phone = normalizeIndianPhone(parentPhone);

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({ data: studentData });

      // Reuse an existing parent if this phone already maps to a Person.
      const person = await tx.person.upsert({
        where: { phone },
        update: parentName ? { name: parentName } : {},
        create: { phone, name: parentName ?? phone },
      });

      // Idempotent on the (personId, tenantId, role) unique triple.
      await tx.membership.upsert({
        where: {
          personId_tenantId_role: {
            personId: person.id,
            tenantId: data.tenantId,
            role: 'PARENT',
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          personId: person.id,
          tenantId: data.tenantId,
          role: 'PARENT',
          status: 'ACTIVE',
        },
      });

      await tx.guardianship.upsert({
        where: { studentId_personId: { studentId: student.id, personId: person.id } },
        update: {},
        create: {
          studentId: student.id,
          personId: person.id,
          relation: relation ?? 'PARENT',
          isPrimary: true,
        },
      });

      return tx.student.findUniqueOrThrow({
        where: { id: student.id },
        include: {
          ageGroup: true,
          route: true,
          stop: true,
          guardianships: { include: { person: true } },
        },
      });
    });
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
