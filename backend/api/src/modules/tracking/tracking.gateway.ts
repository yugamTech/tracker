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
    await this.locationService.ingest(data, data.tenantId);
    // Fan out to all subscribers of this trip
    this.server.to(`trip:${data.tripId}`).emit('trip:location', {
      tripId: data.tripId,
      tenantId: data.tenantId,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      speed: data.speed,
      deviceTs: data.deviceTs,
      sequence: data.sequence,
    });
  }

  // Emit helpers for use by other services
  emitTripStatus(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:status', payload);
  }

  emitAttendance(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:attendance', payload);
  }
}
