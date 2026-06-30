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
        vehicle: true,
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
    const seatsByRoute = await this.seatsUsedByRoute(tenantId);
    return routes.map((r) => ({
      ...r,
      eligibleRiderCount: eligibleByRoute.get(r.id) ?? 0,
      // Seat-capacity surface (fleet-integrity §1): seats used vs the designated
      // bus's capacity (null when no bus is set, so the UI shows "no bus").
      seatsUsed: seatsByRoute.get(r.id) ?? 0,
      capacity: r.vehicle?.capacity ?? null,
    }));
  }

  /**
   * Seats used per route = count of ACTIVE students assigned to the route, whether
   * or not they are pinned to a stop — every assigned active child occupies a seat
   * on the designated bus. The single source of truth for the capacity surface and
   * (via assertRouteCapacity in StudentsService) the hard block on overfilling.
   */
  private async seatsUsedByRoute(tenantId: string): Promise<Map<string, number>> {
    const seats = await this.prisma.student.groupBy({
      by: ['routeId'],
      where: { tenantId, status: 'ACTIVE', routeId: { not: null } },
      _count: { _all: true },
    });
    return new Map(seats.map((s) => [s.routeId as string, s._count._all]));
  }

  // Tenant-scoped read (NFR-05): a route id alone is not enough — it must belong
  // to the caller's tenant or it 404s, so an admin can never read another
  // school's route (and, via the include, its students).
  async findById(id: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({
      where: { id, tenantId },
      include: {
        stops: { include: { stop: true }, orderBy: { sequence: 'asc' } },
        vehicle: true,
        students: { include: { ageGroup: true, stop: true } },
      },
    });
    if (!route) throw new NotFoundException(`Route ${id} not found`);
    const deletable = await this.deleteEligibility(id, tenantId);
    // Seats used = ACTIVE students on this route (detail payload already has the
    // full student list, so no extra query).
    const seatsUsed = route.students.filter((s) => s.status === 'ACTIVE').length;
    return { ...route, deletable, seatsUsed, capacity: route.vehicle?.capacity ?? null };
  }

  create(data: { tenantId: string; name: string }) {
    return this.prisma.route.create({ data });
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{ name: string; status: 'ACTIVE' | 'INACTIVE'; vehicleId: string }>,
  ) {
    await this.assertOwned(id, tenantId);
    const { vehicleId, ...rest } = data;
    const patch: { name?: string; status?: 'ACTIVE' | 'INACTIVE'; vehicleId?: string | null } = { ...rest };
    // Designated-bus assignment: an empty string clears it; a non-empty id must
    // belong to this tenant (NFR-05) and is validated before the write.
    if (vehicleId !== undefined) {
      if (vehicleId === '') {
        patch.vehicleId = null;
      } else {
        const vehicle = await this.prisma.vehicle.findFirst({
          where: { id: vehicleId, tenantId },
          select: { id: true },
        });
        if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);
        patch.vehicleId = vehicleId;
      }
    }
    return this.prisma.route.update({ where: { id }, data: patch });
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
      // RouteStaff FK is RESTRICT — drop the staff↔route links before the route.
      this.prisma.routeStaff.deleteMany({ where: { routeId: id } }),
      this.prisma.route.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  /**
   * Emergency "who's on which bus/route" directory (fleet-integrity §3). For every
   * route returns its designated bus, seats used, the teachers/staff assigned to
   * the route (RouteStaff), and the driver/conductor crew drawn from the route's
   * trips that are happening today or are live right now — with phone numbers so an
   * admin can contact them in an emergency. Tenant-scoped (NFR-05).
   */
  async emergencyDirectory(tenantId: string) {
    const routes = await this.prisma.route.findMany({
      where: { tenantId },
      include: {
        vehicle: { select: { id: true, regNumber: true, capacity: true, status: true } },
        staff: {
          include: {
            membership: {
              select: {
                id: true,
                role: true,
                status: true,
                person: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const seatsByRoute = await this.seatsUsedByRoute(tenantId);

    // Crew (driver/conductor) lives per-Trip, not per-route. For an emergency the
    // relevant crew is whoever is on a trip for this route today or running right
    // now — collect them per route, de-duplicated by person.
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const trips = await this.prisma.trip.findMany({
      where: {
        tenantId,
        OR: [
          { date: { gte: startOfDay, lt: endOfDay } },
          { status: { in: ['STARTED', 'IN_PROGRESS'] } },
        ],
      },
      select: {
        routeId: true,
        driver: { select: { id: true, name: true, phone: true } },
        conductor: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { date: 'desc' },
    });

    type Contact = { id: string; name: string; phone: string };
    const driversByRoute = new Map<string, Map<string, Contact>>();
    const conductorsByRoute = new Map<string, Map<string, Contact>>();
    for (const t of trips) {
      if (t.driver) {
        const m = driversByRoute.get(t.routeId) ?? new Map<string, Contact>();
        m.set(t.driver.id, t.driver);
        driversByRoute.set(t.routeId, m);
      }
      if (t.conductor) {
        const m = conductorsByRoute.get(t.routeId) ?? new Map<string, Contact>();
        m.set(t.conductor.id, t.conductor);
        conductorsByRoute.set(t.routeId, m);
      }
    }

    return routes.map((r) => ({
      routeId: r.id,
      routeName: r.name,
      status: r.status,
      vehicle: r.vehicle ?? null,
      seatsUsed: seatsByRoute.get(r.id) ?? 0,
      capacity: r.vehicle?.capacity ?? null,
      drivers: [...(driversByRoute.get(r.id)?.values() ?? [])],
      conductors: [...(conductorsByRoute.get(r.id)?.values() ?? [])],
      // Only ACTIVE staff memberships — a deactivated teacher isn't aboard.
      teachers: r.staff
        .filter((s) => s.membership.status === 'ACTIVE')
        .map((s) => ({
          membershipId: s.membership.id,
          name: s.membership.person.name,
          phone: s.membership.person.phone,
          role: s.membership.role,
        })),
    }));
  }

  private async assertOwned(routeId: string, tenantId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
  }
}
