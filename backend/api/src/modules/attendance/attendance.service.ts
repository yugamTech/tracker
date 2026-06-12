import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(data: {
    tripId: string;
    studentId: string;
    tenantId: string;
    type: 'BOARDED' | 'ALIGHTED';
    photoUrl?: string;
    markedBy: string;
  }) {
    const event = await this.prisma.attendanceEvent.create({ data });

    // Update trip rider status
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
}
