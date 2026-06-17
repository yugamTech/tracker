import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { normalizeIndianPhone } from './phone.util';

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

  async findById(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        ageGroup: true,
        route: true,
        stop: true,
        guardianships: { include: { person: true } },
      },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
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

  /**
   * Deactivate a student — SOFT delete only (FR-15, audit/DPDP): flips status to
   * INACTIVE so they drop off the active roster and stop being placed on new
   * trips, while the record (and its guardianships/history) is preserved. Never a
   * hard delete. Tenant-scoped (NFR-05) — a student id from another school 404s.
   */
  async deactivate(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return this.prisma.student.update({
      where: { id: student.id },
      data: { status: 'INACTIVE' },
      include: {
        ageGroup: true,
        route: true,
        stop: true,
        guardianships: { include: { person: true } },
      },
    });
  }

  getByGuardian(personId: string) {
    return this.prisma.student.findMany({
      where: { guardianships: { some: { personId } } },
      include: { route: true, stop: true, ageGroup: true },
    });
  }
}
