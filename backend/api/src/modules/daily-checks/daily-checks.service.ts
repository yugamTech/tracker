import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';

/** A check may only be submitted within this many hours before scheduledStart. */
const CHECK_WINDOW_HOURS = 2;

/** Prisma date filter for [start-of-day, end-of-day] around the given instant. */
function dayRange(at: Date): { gte: Date; lte: Date } {
  const gte = new Date(at);
  gte.setHours(0, 0, 0, 0);
  const lte = new Date(at);
  lte.setHours(23, 59, 59, 999);
  return { gte, lte };
}

@Injectable()
export class DailyChecksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a driver's daily vehicle check. submittedById comes from the JWT.
   *
   * Two guards:
   *  - Timing window (FIX B): a check may only be submitted within
   *    `CHECK_WINDOW_HOURS` before the trip's scheduled start (scheduledStart ?? date).
   *  - Idempotency (FIX C): a vehicle/trip can be checked once. If a check already
   *    exists for the same trip (or the same vehicle today), return it instead of
   *    creating a duplicate.
   */
  async create(data: {
    tenantId: string;
    vehicleId: string;
    submittedById: string;
    tripId?: string;
    items: Record<string, boolean>;
    note?: string;
  }) {
    const now = new Date();

    // Resolve the trip (if linked) to enforce the timing window.
    let trip: { scheduledStart: Date | null; date: Date } | null = null;
    if (data.tripId) {
      trip = await this.prisma.trip.findFirst({
        where: { id: data.tripId, tenantId: data.tenantId },
        select: { scheduledStart: true, date: true },
      });
      if (!trip) throw new NotFoundException(`Trip ${data.tripId} not found`);
    }

    // FIX C — idempotency: return any existing check for this trip, else for this
    // vehicle today. The driver UI shows it read-only rather than resubmitting.
    const existing = await this.prisma.dailyCheck.findFirst({
      where: {
        tenantId: data.tenantId,
        ...(data.tripId
          ? { tripId: data.tripId }
          : { vehicleId: data.vehicleId, createdAt: dayRange(now) }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    // FIX B — timing window: now must be at or after scheduledStart − 2h.
    if (trip) {
      const scheduledStart = trip.scheduledStart ?? trip.date;
      const opensAt = new Date(scheduledStart.getTime() - CHECK_WINDOW_HOURS * 60 * 60_000);
      if (now.getTime() < opensAt.getTime()) {
        throw new BadRequestException({
          error: 'CHECK_TOO_EARLY',
          message: `Vehicle check opens ${CHECK_WINDOW_HOURS}h before departure (from ${opensAt.toISOString()}).`,
        });
      }
    }

    return this.prisma.dailyCheck.create({
      data: {
        tenantId: data.tenantId,
        vehicleId: data.vehicleId,
        submittedById: data.submittedById,
        tripId: data.tripId,
        items: data.items,
        note: data.note,
      },
    });
  }

  /** List checks for a tenant, optionally narrowed to a vehicle and/or a day. */
  list(tenantId: string, filters: { vehicleId?: string; date?: Date }) {
    const where: Prisma.DailyCheckWhereInput = { tenantId };
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.date) {
      where.createdAt = dayRange(filters.date);
    }
    return this.prisma.dailyCheck.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
