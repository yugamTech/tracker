import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { TripStatus } from '@saarthi/types';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async start(id: string) {
    return this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.STARTED, startedAt: new Date() },
    });
  }

  async complete(id: string) {
    return this.prisma.trip.update({
      where: { id },
      data: { status: TripStatus.COMPLETED, completedAt: new Date() },
    });
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
}
