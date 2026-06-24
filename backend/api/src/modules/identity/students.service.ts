import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { normalizeIndianPhone } from './phone.util';

/** Returned by deleteEligibility/findById so the UI can show/hide hard-delete. */
export interface DeleteEligibility {
  canDelete: boolean;
  reason: string | null;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hard seat-capacity guard (fleet-integrity §1). Assigning/moving a student onto
   * a route must never exceed its designated bus's capacity. Seats used = ACTIVE
   * students on the route, EXCLUDING the student being assigned (so editing a child
   * already on the route, or moving within it, never falsely trips). A route with
   * no designated bus has no enforceable limit, so it's a no-op there. Throws a
   * clear "Route bus is full (X/Y)" on overflow. Tenant-scoped (NFR-05).
   */
  private async assertRouteCapacity(tenantId: string, routeId: string, excludeStudentId?: string) {
    const route = await this.prisma.route.findFirst({
      where: { id: routeId, tenantId },
      select: { vehicle: { select: { capacity: true } } },
    });
    if (!route?.vehicle) return; // no designated bus → no capacity to enforce
    const capacity = route.vehicle.capacity;
    const used = await this.prisma.student.count({
      where: {
        tenantId,
        routeId,
        status: 'ACTIVE',
        ...(excludeStudentId ? { id: { not: excludeStudentId } } : {}),
      },
    });
    if (used + 1 > capacity) {
      throw new BadRequestException(`Route bus is full (${used}/${capacity})`);
    }
  }

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
    // Carry hard-delete eligibility so the detail screen can show the action only
    // when the record is erasable (no operational history).
    const deletable = await this.deleteEligibility(id, tenantId);
    return { ...student, deletable };
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

    // Seat-capacity hard block — checked before any write so the API (and any
    // caller) can never overfill a route's designated bus.
    if (studentData.routeId) {
      await this.assertRouteCapacity(data.tenantId, studentData.routeId);
    }

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

  async update(
    id: string,
    tenantId: string,
    data: Partial<{ name: string; routeId: string; stopId: string; status: 'ACTIVE' | 'INACTIVE' }>,
  ) {
    // Seat-capacity hard block when assigning/moving onto a route (excluding self,
    // so a no-op edit or stop change on the same route never trips it).
    if (data.routeId) {
      await this.assertRouteCapacity(tenantId, data.routeId, id);
    }
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

  /**
   * Reactivate a student — the inverse of deactivate(): flips status back to
   * ACTIVE so they return to the active roster and are eligible for new trips.
   * Tenant-scoped (NFR-05) — a student id from another school 404s.
   */
  async reactivate(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return this.prisma.student.update({
      where: { id: student.id },
      data: { status: 'ACTIVE' },
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

  /**
   * Whether a student can be HARD-deleted (vs deactivated). Eligible only with
   * zero operational history: never on a trip that ran (a trip with a startedAt —
   * covers STARTED/IN_PROGRESS/COMPLETED and any aborted-after-start) and no
   * attendance event. Otherwise it must be deactivated so audit history survives.
   * Tenant-scoped (NFR-05).
   */
  async deleteEligibility(id: string, tenantId: string): Promise<DeleteEligibility> {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    const [ranRiders, attendance] = await Promise.all([
      this.prisma.tripRider.count({ where: { studentId: id, trip: { startedAt: { not: null } } } }),
      this.prisma.attendanceEvent.count({ where: { studentId: id } }),
    ]);
    if (ranRiders > 0 || attendance > 0) {
      return { canDelete: false, reason: 'This student has trip history — deactivate instead of deleting.' };
    }
    return { canDelete: true, reason: null };
  }

  /**
   * HARD-delete a student (DPDP erasure of a wrongly-added record) — ONLY when
   * eligible (no run-trip / attendance history; re-checked here, never trusting the
   * client). Removes the student and its non-historical dependents in one
   * transaction; complaints are preserved but unlinked (studentId → null) so the
   * complaint audit trail survives. Tenant-scoped (NFR-05).
   */
  async hardDelete(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    const eligibility = await this.deleteEligibility(id, tenantId);
    if (!eligibility.canDelete) throw new BadRequestException(eligibility.reason);

    await this.prisma.$transaction([
      this.prisma.guardianship.deleteMany({ where: { studentId: id } }),
      // Only non-run trips remain for an eligible student (rosters of SCHEDULED /
      // CANCELLED trips) — safe to drop. rideRating/attendance counts are 0 here
      // but cleared defensively.
      this.prisma.tripRider.deleteMany({ where: { studentId: id } }),
      this.prisma.pickupCancellation.deleteMany({ where: { studentId: id } }),
      this.prisma.rideRating.deleteMany({ where: { studentId: id } }),
      this.prisma.attendanceEvent.deleteMany({ where: { studentId: id } }),
      this.prisma.riderFeeAssignment.deleteMany({ where: { studentId: id } }),
      // Preserve the complaint record but detach the erased student (FK is optional).
      this.prisma.complaint.updateMany({ where: { studentId: id }, data: { studentId: null } }),
      this.prisma.student.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }
}
