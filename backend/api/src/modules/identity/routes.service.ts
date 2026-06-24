import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import type { DeleteEligibility } from './students.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const routes = await this.prisma.route.findMany({
      where: { tenantId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });
    // Eligible riders per route = ACTIVE students pinned to a stop — the roster a
    // trip would actually carry (`_count.students` is the raw total, which can be
    // non-zero with nobody eligible). Surfaced so the UI can flag empty routes
    // (0 stops or 0 eligible riders) without a round-trip per route.
    const eligible = await this.prisma.student.groupBy({
      by: ['routeId'],
      where: { tenantId, status: 'ACTIVE', stopId: { not: null }, routeId: { not: null } },
      _count: { _all: true },
    });
    const eligibleByRoute = new Map(eligible.map((e) => [e.routeId, e._count._all]));
    return routes.map((r) => ({ ...r, eligibleRiderCount: eligibleByRoute.get(r.id) ?? 0 }));
  }

  // Tenant-scoped read (NFR-05): a route id alone is not enough — it must belong
  // to the caller's tenant or it 404s, so an admin can never read another
  // school's route (and, via the include, its students).
  async findById(id: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, tenantId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        students: { include: { ageGroup: true, stop: true } },
      },
    });
    if (!route) throw new NotFoundException(`Route ${id} not found`);
    const deletable = await this.deleteEligibility(id, tenantId);
    return { ...route, deletable };
  }

  create(data: { tenantId: string; name: string; direction: 'PICKUP' | 'DROP' }) {
    return this.prisma.route.create({ data });
  }

  async update(id: string, tenantId: string, data: Partial<{ name: string; status: 'ACTIVE' | 'INACTIVE' }>) {
    await this.assertOwned(id, tenantId);
    return this.prisma.route.update({ where: { id }, data });
  }

  /**
   * Deactivate a route — SOFT delete only: flips status to INACTIVE so it drops
   * off the active routes list and can be filtered out, while its stops/students
   * and trip history stay intact. Never a hard delete. Tenant-scoped (NFR-05).
   */
  async deactivate(id: string, tenantId: string) {
    await this.assertOwned(id, tenantId);
    return this.prisma.route.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  /**
   * Reactivate a route — the inverse of deactivate(): flips status back to ACTIVE
   * so it returns to the active routes list and can be scheduled again. Its stops
   * and students are untouched. Tenant-scoped (NFR-05).
   */
  async reactivate(id: string, tenantId: string) {
    await this.assertOwned(id, tenantId);
    return this.prisma.route.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async addStop(tenantId: string, data: { routeId: string; stopId: string; sequence: number }) {
    await this.assertOwned(data.routeId, tenantId);
    // The stop must also belong to this tenant — otherwise an admin could pin
    // another school's stop onto their route.
    const stop = await this.prisma.stop.findFirst({ where: { id: data.stopId, tenantId }, select: { id: true } });
    if (!stop) throw new NotFoundException(`Stop ${data.stopId} not found`);
    return this.prisma.routeStop.create({ data });
  }

  async removeStop(routeId: string, tenantId: string, stopId: string) {
    await this.assertOwned(routeId, tenantId);
    return this.prisma.routeStop.deleteMany({ where: { routeId, stopId } });
  }

  /**
   * Whether a route can be HARD-deleted (vs deactivated): eligible only if NO trip
   * has ever referenced it. A single trip (any status) means it carries history —
   * block and tell the admin to deactivate instead. Tenant-scoped (NFR-05).
   */
  async deleteEligibility(id: string, tenantId: string): Promise<DeleteEligibility> {
    await this.assertOwned(id, tenantId);
    const trips = await this.prisma.trip.count({ where: { routeId: id } });
    if (trips > 0) {
      return { canDelete: false, reason: 'This route has trip history — deactivate it instead of deleting.' };
    }
    return { canDelete: true, reason: null };
  }

  /**
   * HARD-delete a route — ONLY when no trip ever referenced it (re-checked here).
   * Detaches assigned students (routeId/stopId → null) and age groups (routeId →
   * null), removes its stop links, then deletes the route, all in one transaction.
   * Tenant-scoped (NFR-05).
   */
  async hardDelete(id: string, tenantId: string) {
    const eligibility = await this.deleteEligibility(id, tenantId);
    if (!eligibility.canDelete) throw new BadRequestException(eligibility.reason);
    await this.prisma.$transaction([
      this.prisma.student.updateMany({ where: { routeId: id }, data: { routeId: null, stopId: null } }),
      this.prisma.ageGroup.updateMany({ where: { routeId: id }, data: { routeId: null } }),
      this.prisma.routeStop.deleteMany({ where: { routeId: id } }),
      this.prisma.route.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  private async assertOwned(routeId: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
  }
}
