import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LocationService } from './location.service';
import type { LatestPosition } from './location.service';
import type { LocationPingDto } from './dto/location-ping.dto';

@WebSocketGateway({ namespace: '/tracking', cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly locationService: LocationService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:trip')
  handleSubscribe(@MessageBody() tripId: string, @ConnectedSocket() client: Socket) {
    client.join(`trip:${tripId}`);
    this.logger.log(`${client.id} subscribed to trip:${tripId}`);
  }

  @SubscribeMessage('unsubscribe:trip')
  handleUnsubscribe(@MessageBody() tripId: string, @ConnectedSocket() client: Socket) {
    client.leave(`trip:${tripId}`);
  }

  @SubscribeMessage('driver:ping')
  async handleDriverPing(
    @MessageBody() data: LocationPingDto & { driverMembershipId: string; tenantId: string },
  ) {
    const result = await this.locationService.ingestOne(data, data.tenantId);
    if (result.latest) this.broadcastLocation(result.latest);
  }

  /**
   * Fan a reconciled position out to the trip room and the tenant fleet room.
   * Used by both the socket driver:ping path and the REST ingest controller.
   */
  broadcastLocation(latest: LatestPosition) {
    const payload = {
      tripId: latest.tripId,
      tenantId: latest.tenantId,
      lat: latest.lat,
      lng: latest.lng,
      accuracy: latest.accuracy,
      speed: latest.speed ?? undefined,
      deviceTs: latest.deviceTs,
      sequence: latest.sequence,
    };
    this.server.to(`trip:${latest.tripId}`).emit('trip:location', payload);
    this.server.to(`fleet:${latest.tenantId}`).emit('trip:location', payload);
  }

  // Emit helpers for use by other services
  emitTripStatus(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:status', payload);
  }

  emitAttendance(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:attendance', payload);
  }
}
