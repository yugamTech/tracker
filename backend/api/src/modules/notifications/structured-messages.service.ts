import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

const VALID_MESSAGE_KEYS = ['RUNNING_LATE', 'NOT_COMING_TODAY', 'PLEASE_WAIT', 'DIFFERENT_STOP'] as const;
type MessageKey = (typeof VALID_MESSAGE_KEYS)[number];

@Injectable()
export class StructuredMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async send(tripId: string, messageKey: string, senderId: string) {
    if (!VALID_MESSAGE_KEYS.includes(messageKey as MessageKey)) {
      throw new BadRequestException(
        `Invalid messageKey. Must be one of: ${VALID_MESSAGE_KEYS.join(', ')}`,
      );
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, status: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);
    if (!['STARTED', 'IN_PROGRESS'].includes(trip.status)) {
      throw new BadRequestException(`Trip ${tripId} is not active (status=${trip.status})`);
    }

    return this.prisma.structuredMessage.create({
      data: { tripId, senderId, messageKey: messageKey as MessageKey },
      include: { sender: { select: { name: true } } },
    });
  }

  getForTrip(tripId: string) {
    return this.prisma.structuredMessage.findMany({
      where: { tripId },
      orderBy: { sentAt: 'asc' },
      include: { sender: { select: { name: true } } },
    });
  }
}
