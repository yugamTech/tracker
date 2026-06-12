import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { TripStatus, RiderStatus } from '@saarthi/types';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { LocationService } from '../tracking/location.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TrackingGateway,
    private readonly location: LocationService,
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

  start(id: string) {
    return this.transition(id, TripStatus.STARTED, { startedAt: new Date() });
  }

  complete(id: string) {
    return this.transition(id, TripStatus.COMPLETED, { completedAt: new Date() });
  }

  /** Cancel a trip that hasn't started yet (e.g. vehicle breakdown before departure). */
  cancel(id: string) {
    return this.transition(id, TripStatus.CANCELLED);
  }

  /** Abort a trip already under way (mid-route emergency stop). */
  abort(id: string) {
    return this.transition(id, TripStatus.ABORTED, { completedAt: new Date() });
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
