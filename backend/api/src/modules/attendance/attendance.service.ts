import { Injectable, Logger } from '@nestjs/common';
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
    await this.notifications.dispatch({
      eventType: NotifCategory.BOARDING,
      tenantId,
      recipientIds: guardians.map((g) => g.personId),
      variables: {
        studentName,
        time: new Date().toISOString(),
        deepLink: `/track/${tripId}`,
      },
      entityId: `${tripId}:${studentId}`,
    });
  }

  getTripAttendance(tripId: string) {
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
  async getRoster(tripId: string) {
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
