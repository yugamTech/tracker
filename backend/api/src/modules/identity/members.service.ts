import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { Role } from '@saarthi/types';
import { normalizeIndianPhone } from './phone.util';

/**
 * Roles an admin may provision through the staff endpoint (PRD-01 FR-13).
 * PARENT / TEACHER_RIDER are onboarded via students.service (guardian linkage),
 * and FOUNDER / SUPER_ADMIN are provisioned by a higher authority — never here.
 */
export const STAFF_ROLES: Role[] = [
  Role.DRIVER,
  Role.CONDUCTOR,
  Role.ADMIN,
  Role.TRANSPORT_MANAGER,
];

const MEMBER_INCLUDE = {
  person: true,
  vehicleAssignments: { include: { vehicle: true } },
} as const;

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

  async findById(id: string, tenantId: string) {
    const member = await this.prisma.membership.findFirst({
      where: { id, tenantId },
      include: MEMBER_INCLUDE,
    });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return member;
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
      await tx.membership.upsert({
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

      return tx.membership.findFirstOrThrow({
        where: { personId: person.id, tenantId: data.tenantId, role: data.role },
        include: MEMBER_INCLUDE,
      });
    });
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
    data: { name?: string; email?: string; role?: Role },
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
}
