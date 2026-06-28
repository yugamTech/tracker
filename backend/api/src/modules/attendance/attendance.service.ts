import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotifCategory } from '@yaanam/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Record an attendance decision for a single rider.
   *
   * - BOARDED / ALIGHTED create an AttendanceEvent (those are the only two
   *   AttendanceType values). BOARDED also flips the rider to BOARDED and, when
   *   a per-child photoUrl is attached, that photo rides on the event so the
   *   guardian can later see it. ALIGHTED is recorded but leaves boardStatus.
   * - NOT_BOARDED is *not* an event type — it only flips the rider's boardStatus
   *   to NOT_BOARDED so the absence is persisted (no AttendanceEvent row).
   *
   * Returns the created event (BOARDED/ALIGHTED) or the rider's resolved state
   * (NOT_BOARDED), both carrying the student's name for the trip:attendance
   * fan-out.
   */
  async mark(data: {
    tripId: string;
    studentId: string;
    tenantId: string;
    type: 'BOARDED' | 'ALIGHTED' | 'NOT_BOARDED';
    photoUrl?: string;
    markedBy: string;
  }) {
    // Authorize the target before any write: the student must be a rider on this
    // trip AND the trip must belong to the caller's tenant. Without this, a bare
    // tripId+studentId let a caller mark attendance on another school's trip
    // (cross-tenant write) or for a child not even on the trip.
    const onTrip = await this.prisma.tripRider.findFirst({
      where: { tripId: data.tripId, studentId: data.studentId, trip: { tenantId: data.tenantId } },
      select: { id: true },
    });
    if (!onTrip) {
      throw new NotFoundException(`Student ${data.studentId} is not a rider on trip ${data.tripId}`);
    }

    if (data.type === 'NOT_BOARDED') {
      await this.prisma.tripRider.updateMany({
        where: { tripId: data.tripId, studentId: data.studentId },
        data: { boardStatus: 'NOT_BOARDED' },
      });
      const student = await this.prisma.student.findUniqueOrThrow({
        where: { id: data.studentId },
        select: { name: true },
      });
      return {
        tripId: data.tripId,
        studentId: data.studentId,
        tenantId: data.tenantId,
        type: 'NOT_BOARDED' as const,
        photoUrl: null,
        ts: new Date(),
        student,
      };
    }

    // Idempotency for BOARDED: a re-mark of an already-BOARDED rider must NOT
    // create a second AttendanceEvent nor re-fire the boarding push. The
    // notification dedup window (60s) can lapse, so without this guard a second
    // tap minutes later would double-notify the guardians and double the audit
    // trail. Return the existing boarding event unchanged so the caller (and the
    // trip:attendance fan-out) still sees a consistent event.
    if (data.type === 'BOARDED') {
      const rider = await this.prisma.tripRider.findFirst({
        where: { tripId: data.tripId, studentId: data.studentId },
        select: { boardStatus: true },
      });
      if (rider?.boardStatus === 'BOARDED') {
        const existing = await this.prisma.attendanceEvent.findFirst({
          where: { tripId: data.tripId, studentId: data.studentId, type: 'BOARDED' },
          orderBy: { ts: 'desc' },
          include: { student: { select: { name: true } } },
        });
        if (existing) return existing;
        // Defensive: status is BOARDED but no event row exists (shouldn't happen)
        // — fall through and create one so the caller always gets an event.
      }
    }

    const event = await this.prisma.attendanceEvent.create({
      data: {
        tripId: data.tripId,
        studentId: data.studentId,
        tenantId: data.tenantId,
        type: data.type,
        photoUrl: data.photoUrl,
        markedBy: data.markedBy,
      },
      include: { student: { select: { name: true } } },
    });

    if (data.type === 'BOARDED') {
      await this.prisma.tripRider.updateMany({
        where: { tripId: data.tripId, studentId: data.studentId },
        data: { boardStatus: 'BOARDED' },
      });
      // Fire-and-forget: tell the guardians their child boarded. Never block or
      // fail the attendance write on a notification error.
      this.notifyBoarding(data.tripId, data.studentId, data.tenantId, event.student.name).catch(
        (err) => this.logger.error(`BOARDING dispatch failed: ${(err as Error).message}`),
      );
    }
    return event;
  }

  /** Resolve the boarded student's guardians and dispatch a BOARDING notification. */
  private async notifyBoarding(
    tripId: string,
    studentId: string,
    tenantId: string,
    studentName: string,
  ) {
    const guardians = await this.prisma.guardianship.findMany({
      where: { studentId },
      select: { personId: true },
    });
    if (!guardians.length) return;
    // Enrich the push so it names the child, the boarding stop, and the
    // route/direction — "<child> boarded at <stop> — <route> (pickup)" instead
    // of a bare "Boarded the bus".
    const rider = await this.prisma.tripRider.findFirst({
      where: { tripId, studentId },
      select: {
        stop: { select: { name: true } },
        trip: { select: { direction: true, route: { select: { name: true } } } },
      },
    });
    await this.notifications.dispatch({
      eventType: NotifCategory.BOARDING,
      tenantId,
      recipientIds: guardians.map((g) => g.personId),
      variables: {
        studentName,
        ...(rider?.stop?.name ? { stopName: rider.stop.name } : {}),
        ...(rider?.trip?.route?.name ? { routeName: rider.trip.route.name } : {}),
        ...(rider?.trip?.direction ? { direction: rider.trip.direction } : {}),
        time: new Date().toISOString(),
        deepLink: `/track/${tripId}`,
      },
      entityId: `${tripId}:${studentId}`,
    });
  }

  /** A trip must belong to the caller's tenant — these reads take a bare tripId,
   * so without this any authenticated user could pull any trip's roster (incl.
   * guardian names + phones) or attendance. 404 hides cross-tenant ids. */
  private async assertTripInTenant(tripId: string, tenantId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, tenantId }, select: { id: true } });
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);
  }

  async getTripAttendance(tripId: string, tenantId: string) {
    await this.assertTripInTenant(tripId, tenantId);
    return this.prisma.attendanceEvent.findMany({
      where: { tripId },
      include: { student: true },
      orderBy: { ts: 'asc' },
    });
  }

  /**
   * Driver roster for a trip: every rider with their stop, current board
   * status, and last photo — grouped by stop in route order, with a summary.
   */
  async getRoster(tripId: string, tenantId: string) {
    await this.assertTripInTenant(tripId, tenantId);
    const riders = await this.prisma.tripRider.findMany({
      where: { tripId },
      include: {
        student: {
          include: {
            guardianships: { include: { person: { select: { name: true, phone: true } } } },
          },
        },
        stop: true,
      },
    });

    // Stops must come back in route sequence so the driver app can service them
    // in order. tripRider has no sequence, so resolve it from the trip's route.
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { route: { select: { stops: { select: { stopId: true, sequence: true } } } } },
    });
    const seqByStop = new Map<string, number>();
    for (const rs of trip?.route?.stops ?? []) seqByStop.set(rs.stopId, rs.sequence);
    const events = await this.prisma.attendanceEvent.findMany({
      where: { tripId },
      orderBy: { ts: 'desc' },
    });
    const lastEvent = new Map<string, (typeof events)[number]>();
    for (const e of events) if (!lastEvent.has(e.studentId)) lastEvent.set(e.studentId, e);

    const byStop = new Map<string, { stopId: string; stopName: string; sequence: number; riders: unknown[] }>();
    for (const r of riders) {
      if (!byStop.has(r.stopId)) {
        byStop.set(r.stopId, {
          stopId: r.stopId,
          stopName: r.stop.name,
          sequence: seqByStop.get(r.stopId) ?? Number.MAX_SAFE_INTEGER,
          riders: [],
        });
      }
      const last = lastEvent.get(r.studentId);
      // Guardian contact so an admin (or driver) can reach a parent/teacher "in
      // case of anything" (FOUNDATION §2.5). Primary guardian first.
      const guardians = [...r.student.guardianships]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((g) => ({
          name: g.person.name,
          phone: g.person.phone,
          relation: g.relation,
          isPrimary: g.isPrimary,
        }));
      byStop.get(r.stopId)!.riders.push({
        studentId: r.studentId,
        studentName: r.student.name,
        boardStatus: r.boardStatus,
        photoUrl: last?.photoUrl ?? null,
        lastEventType: last?.type ?? null,
        lastEventTs: last?.ts ?? null,
        guardians,
      });
    }

    const summary = {
      total: riders.length,
      boarded: riders.filter((r) => r.boardStatus === 'BOARDED').length,
      notBoarded: riders.filter((r) => r.boardStatus === 'NOT_BOARDED').length,
      cancelled: riders.filter((r) => r.boardStatus === 'CANCELLED').length,
      expected: riders.filter((r) => r.boardStatus === 'EXPECTED').length,
    };
    // Emit stops in route sequence (the driver services them in order).
    const stops = [...byStop.values()].sort((a, b) => a.sequence - b.sequence);
    return { tripId, summary, stops };
  }

  /** Persist an attendance photo and return its (locally-stubbed) URL. */
  async savePhoto(filename: string, contentType = 'image/jpeg', base64?: string) {
    const buffer = base64 ? Buffer.from(base64, 'base64') : Buffer.alloc(0);
    const url = await this.storage.upload(buffer, `attendance/${filename}`, contentType);
    return { url };
  }
}
