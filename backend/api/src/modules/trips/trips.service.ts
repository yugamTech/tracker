import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { TripStatus, RiderStatus, NotifCategory } from '@saarthi/types';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { LocationService } from '../tracking/location.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Allowed status transitions for the trip lifecycle state machine. */
const TRANSITIONS: Record<string, TripStatus[]> = {
  [TripStatus.SCHEDULED]: [TripStatus.STARTED, TripStatus.CANCELLED],
  [TripStatus.STARTED]: [TripStatus.IN_PROGRESS, TripStatus.COMPLETED, TripStatus.ABORTED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.ABORTED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
  [TripStatus.ABORTED]: [],
};

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TrackingGateway,
    private readonly location: LocationService,
    private readonly notifications: NotificationsService,
  ) {}

  list(tenantId: string, filters?: { date?: Date; status?: TripStatus }) {
    return this.prisma.trip.findMany({
      where: {
        tenantId,
        ...(filters?.date && { date: { gte: filters.date } }),
        ...(filters?.status && { status: filters.status }),
      },
      include: { route: true, vehicle: true, riders: { include: { student: true, stop: true } } },
      orderBy: { date: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.trip.findUniqueOrThrow({
      where: { id },
      include: {
        route: { include: { stops: { include: { stop: true }, orderBy: { sequence: 'asc' } } } },
        vehicle: true,
        riders: { include: { student: true, stop: true } },
        attendanceEvents: { orderBy: { ts: 'asc' } },
        geofenceEvents: { orderBy: { ts: 'asc' } },
      },
    });
  }

  getTodayTrips(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.prisma.trip.findMany({
      where: { tenantId, date: { gte: start, lte: end } },
      include: { route: true, vehicle: true, riders: true },
      orderBy: { date: 'asc' },
    });
  }

  /** Validated status transition + trip:status fan-out. */
  private async transition(
    id: string,
    to: TripStatus,
    extra: { startedAt?: Date; completedAt?: Date } = {},
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    const allowed = TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot move trip from ${trip.status} to ${to}`);
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: { status: to, ...extra },
    });

    this.gateway.emitTripStatus(id, trip.tenantId, {
      tripId: id,
      tenantId: trip.tenantId,
      status: to,
      ts: new Date().toISOString(),
    });
    return updated;
  }

  async start(id: string) {
    const updated = await this.transition(id, TripStatus.STARTED, { startedAt: new Date() });
    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_START).catch((err) =>
      this.logger.error(`TRIP_START dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  async complete(id: string) {
    const updated = await this.transition(id, TripStatus.COMPLETED, { completedAt: new Date() });
    this.notifyGuardiansOnTrip(id, NotifCategory.TRIP_END).catch((err) =>
      this.logger.error(`TRIP_END dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Cancel a trip that hasn't started yet (e.g. vehicle breakdown before departure). */
  async cancel(id: string) {
    const updated = await this.transition(id, TripStatus.CANCELLED);
    this.notifyPickupCancelled(id).catch((err) =>
      this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Abort a trip already under way (mid-route emergency stop). */
  async abort(id: string) {
    const updated = await this.transition(id, TripStatus.ABORTED, { completedAt: new Date() });
    this.notifyPickupCancelled(id).catch((err) =>
      this.logger.error(`PICKUP_CANCELLED dispatch failed: ${(err as Error).message}`),
    );
    return updated;
  }

  /** Resolve every guardian of every rider on the trip and dispatch a trip-lifecycle event. */
  private async notifyGuardiansOnTrip(tripId: string, eventType: NotifCategory) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { tenantId: true },
    });
    if (!trip) return;
    const riders = await this.prisma.tripRider.findMany({
      where: { tripId },
      select: { studentId: true },
    });
    if (!riders.length) return;
    const guardians = await this.prisma.guardianship.findMany({
      where: { studentId: { in: riders.map((r) => r.studentId) } },
      select: { personId: true },
    });
    const recipientIds = [...new Set(guardians.map((g) => g.personId))];
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType,
      tenantId: trip.tenantId,
      recipientIds,
      variables: { tripId, deepLink: `/track/${tripId}` },
      entityId: tripId,
    });
  }

  /** Resolve the trip's driver/conductor + tenant admins and dispatch PICKUP_CANCELLED. */
  private async notifyPickupCancelled(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { tenantId: true, vehicleId: true },
    });
    if (!trip) return;
    const recipientIds = new Set<string>();
    if (trip.vehicleId) {
      const assignments = await this.prisma.vehicleAssignment.findMany({
        where: { vehicleId: trip.vehicleId },
        include: { membership: { select: { personId: true } } },
      });
      for (const a of assignments) recipientIds.add(a.membership.personId);
    }
    const admins = await this.prisma.membership.findMany({
      where: { tenantId: trip.tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never } },
      select: { personId: true },
    });
    for (const a of admins) recipientIds.add(a.personId);
    if (!recipientIds.size) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.PICKUP_CANCELLED,
      tenantId: trip.tenantId,
      recipientIds: [...recipientIds],
      variables: { tripId, deepLink: `/track/${tripId}` },
      entityId: tripId,
    });
  }

  /**
   * Parent cancels a single child's pickup for this trip. Records a
   * PickupCancellation and flips that rider to CANCELLED so the driver roster
   * and not-boarded automation skip them.
   */
  async cancelPickup(tripId: string, studentId: string, cancelledBy: string, reason?: string) {
    const rider = await this.prisma.tripRider.findFirst({ where: { tripId, studentId } });
    if (!rider) throw new NotFoundException(`Student ${studentId} is not a rider on trip ${tripId}`);
    if (rider.boardStatus === RiderStatus.BOARDED) {
      throw new BadRequestException('Cannot cancel pickup — student already boarded');
    }

    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { tenantId: true },
    });

    const [cancellation] = await this.prisma.$transaction([
      this.prisma.pickupCancellation.create({
        data: { tripId, studentId, tenantId: trip.tenantId, cancelledBy, reason },
      }),
      this.prisma.tripRider.update({
        where: { id: rider.id },
        data: { boardStatus: RiderStatus.CANCELLED },
      }),
    ]);
    return cancellation;
  }

  create(data: {
    tenantId: string;
    routeId: string;
    vehicleId?: string;
    date: Date;
    direction: 'PICKUP' | 'DROP';
  }) {
    return this.prisma.trip.create({ data });
  }

  /**
   * DEV ONLY: wipe a trip's tracking artifacts and return it to SCHEDULED so a
   * demo (e.g. the driver-ping simulator) can be replayed cleanly. Guarded at
   * the controller behind OTP_BYPASS_MODE.
   */
  async resetForDemo(tripId: string) {
    await this.prisma.$transaction([
      this.prisma.attendanceEvent.deleteMany({ where: { tripId } }),
      this.prisma.geofenceEvent.deleteMany({ where: { tripId } }),
      this.prisma.speedEvent.deleteMany({ where: { tripId } }),
      this.prisma.pickupCancellation.deleteMany({ where: { tripId } }),
      this.prisma.locationPing.deleteMany({ where: { tripId } }),
      this.prisma.tripRider.updateMany({ where: { tripId }, data: { boardStatus: RiderStatus.EXPECTED } }),
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: TripStatus.SCHEDULED, startedAt: null, completedAt: null },
      }),
    ]);
    await this.location.clearTripCache(tripId);
    return { tripId, status: TripStatus.SCHEDULED, reset: true };
  }
}
