import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

/**
 * AgeGroups = "Shifts" in the UI. An AgeGroup is the school-shift a student
 * belongs to (name + pickup/drop time, optionally pinned to a route). Every CRUD
 * path is tenant-scoped (NFR-05): a shift id from another school must 404, never
 * leak or mutate. A shift that still has students cannot be deleted — that would
 * orphan their required ageGroupId — so delete refuses with 409 until they are
 * reassigned.
 */
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

  async create(data: { tenantId: string; name: string; pickupTime: string; dropTime: string; routeId?: string }) {
    // A pinned route must belong to this school (tenant isolation) before we
    // store the link — mirrors how trips verify every referenced entity.
    if (data.routeId) await this.assertRouteOwned(data.routeId, data.tenantId);
    return this.prisma.ageGroup.create({ data });
  }

  /**
   * Patch a shift — only the supplied fields change. Tenant-scoped: a cross-tenant
   * or unknown id 404s (findFirst → NotFoundException, never findFirstOrThrow which
   * would 500). A re-pinned route is re-verified to belong to this school.
   */
  async update(
    id: string,
    tenantId: string,
    patch: { name?: string; pickupTime?: string; dropTime?: string; routeId?: string | null },
  ) {
    const shift = await this.prisma.ageGroup.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!shift) throw new NotFoundException(`Shift ${id} not found`);
    if (patch.routeId) await this.assertRouteOwned(patch.routeId, tenantId);

    const data: { name?: string; pickupTime?: string; dropTime?: string; routeId?: string | null } = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.pickupTime !== undefined) data.pickupTime = patch.pickupTime;
    if (patch.dropTime !== undefined) data.dropTime = patch.dropTime;
    // An empty-string routeId clears the pin; a non-empty one (re)assigns it.
    if (patch.routeId !== undefined) data.routeId = patch.routeId || null;

    return this.prisma.ageGroup.update({ where: { id }, data });
  }

  /**
   * Delete a shift — tenant-scoped, and ONLY when no student still references it.
   * Student.ageGroupId is required, so deleting a shift with students would orphan
   * them; we refuse with 409 and a clear message until they are reassigned.
   */
  async delete(id: string, tenantId: string) {
    const shift = await this.prisma.ageGroup.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!shift) throw new NotFoundException(`Shift ${id} not found`);

    const studentCount = await this.prisma.student.count({ where: { tenantId, ageGroupId: id } });
    if (studentCount > 0) {
      throw new ConflictException(
        `Reassign students before deleting this shift — ${studentCount} student${studentCount === 1 ? '' : 's'} still belong to it.`,
      );
    }
    await this.prisma.ageGroup.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Verify a route belongs to this tenant before linking a shift to it (NFR-05). */
  private async assertRouteOwned(routeId: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
  }
}
