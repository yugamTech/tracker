import { Injectable, Logger } from '@nestjs/common';
import { NotifCategory } from '@saarthi/types';
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
   * Record a board/alight event and return it with the student's name (for the
   * trip:attendance fan-out). Boarding flips the rider to BOARDED; alighting is
   * recorded as an event but leaves boardStatus (they did board).
   */
  async mark(data: {
    tripId: string;
    studentId: string;
    tenantId: string;
    type: 'BOARDED' | 'ALIGHTED';
    photoUrl?: string;
    markedBy: string;
  }) {
    const event = await this.prisma.attendanceEvent.create({
      data,
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
      include: { student: true, stop: true },
    });
    const events = await this.prisma.attendanceEvent.findMany({
      where: { tripId },
      orderBy: { ts: 'desc' },
    });
    const lastEvent = new Map<string, (typeof events)[number]>();
    for (const e of events) if (!lastEvent.has(e.studentId)) lastEvent.set(e.studentId, e);

    const byStop = new Map<string, { stopId: string; stopName: string; riders: unknown[] }>();
    for (const r of riders) {
      if (!byStop.has(r.stopId)) {
        byStop.set(r.stopId, { stopId: r.stopId, stopName: r.stop.name, riders: [] });
      }
      const last = lastEvent.get(r.studentId);
      byStop.get(r.stopId)!.riders.push({
        studentId: r.studentId,
        studentName: r.student.name,
        boardStatus: r.boardStatus,
        photoUrl: last?.photoUrl ?? null,
        lastEventType: last?.type ?? null,
        lastEventTs: last?.ts ?? null,
      });
    }

    const summary = {
      total: riders.length,
      boarded: riders.filter((r) => r.boardStatus === 'BOARDED').length,
      notBoarded: riders.filter((r) => r.boardStatus === 'NOT_BOARDED').length,
      cancelled: riders.filter((r) => r.boardStatus === 'CANCELLED').length,
      expected: riders.filter((r) => r.boardStatus === 'EXPECTED').length,
    };
    return { tripId, summary, stops: [...byStop.values()] };
  }

  /** Persist an attendance photo and return its (locally-stubbed) URL. */
  async savePhoto(filename: string, contentType = 'image/jpeg', base64?: string) {
    const buffer = base64 ? Buffer.from(base64, 'base64') : Buffer.alloc(0);
    const url = await this.storage.upload(buffer, `attendance/${filename}`, contentType);
    return { url };
  }
}
