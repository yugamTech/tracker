import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';
import { Role } from '@yaanam/types';
import { normalizeIndianPhone } from './phone.util';
import type { DeleteEligibility } from './students.service';

/** Interactive-transaction client handed to the per-tx helpers below. */
type PrismaTx = Prisma.TransactionClient;

/**
 * Roles an admin may provision through the staff endpoint (PRD-01 FR-13).
 * PARENT / TEACHER_RIDER are onboarded via students.service (guardian linkage),
 * and FOUNDER / SUPER_ADMIN are provisioned by a higher authority — never here.
 * TEACHER is the lightweight "rides a route to supervise" staff role (fleet-
 * integrity §2) — provisioned here and assignable to a route via RouteStaff.
 */
export const STAFF_ROLES: Role[] = [
  Role.DRIVER,
  Role.CONDUCTOR,
  Role.TEACHER,
  Role.ADMIN,
  Role.TRANSPORT_MANAGER,
];

const MEMBER_INCLUDE = {
  person: true,
  vehicleAssignments: { include: { vehicle: true } },
  // The route(s) this staff member is assigned to (teacher-on-route, §2). The bus
  // is derived via route.vehicleId; the form manages a single assignment.
  routeStaff: { include: { route: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List staff for a tenant. PARENTS ARE NOT STAFF (PRD-01 §7): parents are
   * managed via students.service (guardian linkage), so this endpoint is scoped
   * to STAFF_ROLES only — a role query is honoured only if it IS a staff role,
   * and the unfiltered list returns every staff role but never PARENT.
   *
   * `includeInactive` widens the status filter to surface deactivated (SUSPENDED)
   * staff for the management list (reactivation, status filtering). It defaults
   * off so driver/conductor pickers (trips, complaints) keep getting ACTIVE
   * staff only — ACTIVE-membership filtering elsewhere is unchanged.
   */
  list(tenantId: string, role?: string, includeInactive = false) {
    if (role && !STAFF_ROLES.includes(role as Role)) {
      throw new BadRequestException(`Role ${role} is not a staff role`);
    }
    return this.prisma.membership.findMany({
      where: {
        tenantId,
        role: role ? (role as Role) : { in: STAFF_ROLES },
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
      include: { person: true },
      orderBy: { person: { name: 'asc' } },
    });
  }

  /**
   * List parents for a tenant. Parents are managed via guardian linkage (not
   * the staff endpoint) so they're returned separately here with their linked
   * students so the admin can see who each parent belongs to.
   */
  listParents(tenantId: string, includeInactive = false) {
    return this.prisma.membership.findMany({
      where: {
        tenantId,
        role: Role.PARENT,
        ...(includeInactive ? {} : { status: 'ACTIVE' }),
      },
      include: {
        person: {
          include: {
            guardianships: {
              where: { student: { tenantId } },
              include: {
                student: {
                  select: { id: true, name: true, status: true, regId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { person: { name: 'asc' } },
    });
  }

  async findById(id: string, tenantId: string) {
    const member = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      include: MEMBER_INCLUDE,
    });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    const deletable = await this.deleteEligibility(id, tenantId);
    return { ...member, deletable };
  }

  /**
   * Provision a staff member. Mirrors students.service.create(): in ONE
   * transaction upsert the global Person (idempotent on E.164 phone) and grant
   * an ACTIVE membership idempotent on the (personId, tenantId, role) unique
   * triple (PRD-01 FR-13/FR-14).
   *
   * A staff phone may already belong to a Person (e.g. they're also a parent at
   * this or another school). We ADD the membership and leave the existing Person
   * untouched — never clobber a name/email that other tenants depend on. Re-adding
   * the same role just re-activates the membership (idempotent).
   */
  async create(data: {
    tenantId: string;
    name: string;
    phone: string;
    role: Role;
    email?: string;
    // Optional route to mark this staff member (esp. a teacher) as riding/
    // supervising — a RouteStaff link (§2). The bus is derived from the route.
    routeId?: string;
  }) {
    if (!STAFF_ROLES.includes(data.role)) {
      throw new BadRequestException(`Role ${data.role} cannot be provisioned via the staff endpoint`);
    }

    const phone = normalizeIndianPhone(data.phone);

    return this.prisma.$transaction(async (tx) => {
      // Reuse an existing Person if this phone is already known; only set
      // name/email when creating a brand-new identity (never overwrite).
      const person = await tx.person.upsert({
        where: { phone },
        update: {},
        create: { phone, name: data.name, email: data.email },
      });

      // Idempotent on the (personId, tenantId, role) unique triple.
      const membership = await tx.membership.upsert({
        where: {
          personId_tenantId_role: {
            personId: person.id,
            tenantId: data.tenantId,
            role: data.role,
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          personId: person.id,
          tenantId: data.tenantId,
          role: data.role,
          status: 'ACTIVE',
        },
      });

      if (data.routeId) {
        await this.assignRoute(tx, data.tenantId, membership.id, data.routeId);
      }

      return tx.membership.findFirstOrThrow({
        where: { id: membership.id },
        include: MEMBER_INCLUDE,
      });
    });
  }

  /**
   * Set a staff member's route assignment (teacher-on-route, §2). The form manages
   * a SINGLE assignment, so this clears any existing RouteStaff for the membership
   * and, when a route is given, links the new one. An empty/undefined routeId just
   * clears it. The route must belong to the tenant (NFR-05). Runs inside the
   * caller's transaction.
   */
  private async assignRoute(
    tx: PrismaTx,
    tenantId: string,
    membershipId: string,
    routeId: string,
  ) {
    await tx.routeStaff.deleteMany({ where: { membershipId } });
    if (!routeId) return;
    const route = await tx.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
    await tx.routeStaff.create({ data: { tenantId, routeId, membershipId } });
  }

  /**
   * Edit a staff member. name/email live on the global Person; role lives on the
   * tenant-scoped Membership. The membership is verified to belong to the caller's
   * tenant before any write (tenant isolation, NFR-05). A role change that would
   * collide with an existing membership for this person+tenant is rejected.
   */
  async update(
    id: string,
    tenantId: string,
    data: { name?: string; email?: string; role?: Role; routeId?: string },
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      select: { id: true, personId: true, role: true },
    });
    if (!membership) throw new NotFoundException(`Member ${id} not found`);

    if (data.role && !STAFF_ROLES.includes(data.role)) {
      throw new BadRequestException(`Role ${data.role} is not assignable via the staff endpoint`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.name !== undefined || data.email !== undefined) {
        await tx.person.update({
          where: { id: membership.personId },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.email !== undefined ? { email: data.email } : {}),
          },
        });
      }

      // Route assignment (teacher-on-route): undefined leaves it untouched; an
      // empty string clears it; a route id (re)assigns. Single assignment via form.
      if (data.routeId !== undefined) {
        await this.assignRoute(tx, tenantId, membership.id, data.routeId);
      }

      if (data.role && data.role !== membership.role) {
        const clash = await tx.membership.findUnique({
          where: {
            personId_tenantId_role: {
              personId: membership.personId,
              tenantId,
              role: data.role,
            },
          },
          select: { id: true },
        });
        if (clash) {
          throw new ConflictException(`This person already has a ${data.role} membership in this school`);
        }
        await tx.membership.update({ where: { id: membership.id }, data: { role: data.role } });
      }

      return tx.membership.findFirstOrThrow({
        where: { id: membership.id },
        include: MEMBER_INCLUDE,
      });
    });
  }

  /**
   * Deactivate a staff member — SOFT delete only (FR-15, audit/DPDP). Suspends
   * the tenant-scoped Membership so they drop off the active staff list and lose
   * access at this school, while their global Person identity (and any memberships
   * at other schools) is preserved. Never a hard delete.
   */
  async deactivate(id: string, tenantId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException(`Member ${id} not found`);

    return this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'SUSPENDED' },
      include: MEMBER_INCLUDE,
    });
  }

  /**
   * Reactivate a staff member — the inverse of deactivate(). Restores the
   * tenant-scoped Membership to ACTIVE so they reappear on the active staff list
   * and regain access at this school. Soft state only; the Person identity and
   * any other-school memberships are untouched. Tenant-scoped (NFR-05).
   */
  async reactivate(id: string, tenantId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException(`Member ${id} not found`);

    return this.prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'ACTIVE' },
      include: MEMBER_INCLUDE,
    });
  }

  /**
   * Whether a staff member can be HARD-deleted (vs deactivated): eligible only if
   * the person never drove or conducted a trip that RAN (a trip with a startedAt) in
   * this tenant. Otherwise their operational history must survive — deactivate
   * instead. Tenant-scoped (NFR-05).
   */
  async deleteEligibility(id: string, tenantId: string): Promise<DeleteEligibility> {
    const membership = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      select: { id: true, personId: true },
    });
    if (!membership) throw new NotFoundException(`Member ${id} not found`);
    const ran = await this.prisma.trip.count({
      where: {
        tenantId,
        startedAt: { not: null },
        OR: [{ driverId: membership.personId }, { conductorId: membership.personId }],
      },
    });
    if (ran > 0) {
      return {
        canDelete: false,
        reason: 'This staff member has driven or conducted a trip that ran — deactivate instead of deleting.',
      };
    }
    return { canDelete: true, reason: null };
  }

  /**
   * HARD-delete a staff member — ONLY when eligible (no run-trip history; re-checked
   * here). Removes the tenant Membership and its dependents (driver profile, vehicle
   * assignments). The global Person is deleted too ONLY when it becomes fully
   * orphaned — no other membership (any school), not a guardian, no trip still
   * referencing them (e.g. a future SCHEDULED assignment), and no structured
   * message — otherwise the Person identity is preserved. Tenant-scoped (NFR-05).
   */
  async hardDelete(id: string, tenantId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      select: { id: true, personId: true },
    });
    if (!membership) throw new NotFoundException(`Member ${id} not found`);
    const eligibility = await this.deleteEligibility(id, tenantId);
    if (!eligibility.canDelete) throw new BadRequestException(eligibility.reason);

    const personId = membership.personId;
    const personDeleted = await this.prisma.$transaction(async (tx) => {
      // Required FKs onto the membership must go first.
      await tx.driverProfile.deleteMany({ where: { membershipId: id } });
      await tx.vehicleAssignment.deleteMany({ where: { membershipId: id } });
      await tx.routeStaff.deleteMany({ where: { membershipId: id } });
      await tx.membership.delete({ where: { id } });

      // Delete the Person only when nothing else references it (run sequentially —
      // an interactive transaction is single-connection).
      const otherMemberships = await tx.membership.count({ where: { personId } });
      const guardianships = await tx.guardianship.count({ where: { personId } });
      const trips = await tx.trip.count({
        where: { OR: [{ driverId: personId }, { conductorId: personId }] },
      });
      const messages = await tx.structuredMessage.count({ where: { senderId: personId } });
      if (otherMemberships === 0 && guardianships === 0 && trips === 0 && messages === 0) {
        await tx.deviceToken.deleteMany({ where: { personId } });
        await tx.consent.deleteMany({ where: { personId } });
        await tx.notificationPreference.deleteMany({ where: { personId } });
        await tx.person.delete({ where: { id: personId } });
        return true;
      }
      return false;
    });
    return { id, deleted: true, personDeleted };
  }
}
