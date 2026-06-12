import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
    }
    return event;
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
