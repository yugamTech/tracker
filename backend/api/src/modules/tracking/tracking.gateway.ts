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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LocationService } from './location.service';
import type { LatestPosition, IngestResult } from './location.service';
import { GeofenceService } from './geofence.service';
import { EtaService } from './eta.service';
import { SpeedService } from './speed.service';
import type { LocationPingDto } from './dto/location-ping.dto';
import { NotifCategory, RiderStatus } from '@yaanam/types';
import type { JwtPayload } from '@yaanam/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Roles allowed to watch the whole tenant fleet. */
const FLEET_ROLES = ['ADMIN', 'TRANSPORT_MANAGER', 'FOUNDER', 'SUPER_ADMIN'];

interface SocketData {
  personId: string;
  membershipId: string;
  tenantId: string;
  role: string;
}

@WebSocketGateway({ namespace: '/tracking', cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly locationService: LocationService,
    private readonly geofenceService: GeofenceService,
    private readonly etaService: EtaService,
    private readonly speedService: SpeedService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Verify the JWT presented on the handshake; reject the socket if invalid. */
  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string | undefined);

    if (!token) {
      this.logger.warn(`Rejecting socket ${client.id}: no token`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      const data: SocketData = {
        personId: payload.sub,
        membershipId: payload.membershipId,
        tenantId: payload.tenantId,
        role: payload.role,
      };
      client.data = data;
      this.logger.log(`Socket ${client.id} authed (tenant=${data.tenantId}, role=${data.role})`);
    } catch {
      this.logger.warn(`Rejecting socket ${client.id}: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:trip')
  async handleSubscribe(@MessageBody() tripId: string, @ConnectedSocket() client: Socket) {
    const { tenantId } = (client.data ?? {}) as SocketData;
    if (!tenantId || typeof tripId !== 'string') return;

    // Scoped join: a client may only watch trips belonging to its own tenant.
    const tripTenant = await this.locationService.getTripTenant(tripId);
    if (!tripTenant || tripTenant !== tenantId) {
      this.logger.warn(`Denied ${client.id} -> trip:${tripId} (cross-tenant or unknown)`);
      return;
    }
    client.join(`trip:${tripId}`);
    this.logger.log(`${client.id} subscribed to trip:${tripId}`);
  }

  @SubscribeMessage('unsubscribe:trip')
  handleUnsubscribe(@MessageBody() tripId: string, @ConnectedSocket() client: Socket) {
    if (typeof tripId === 'string') client.leave(`trip:${tripId}`);
  }

  @SubscribeMessage('subscribe:fleet')
  handleSubscribeFleet(@ConnectedSocket() client: Socket) {
    const { tenantId, role } = (client.data ?? {}) as SocketData;
    if (!tenantId) return;
    if (!FLEET_ROLES.includes(role)) {
      this.logger.warn(`Denied ${client.id} -> fleet:${tenantId} (role ${role})`);
      return;
    }
    // Always scoped to the JWT tenant — clients can't pick another tenant's fleet.
    client.join(`fleet:${tenantId}`);
    this.logger.log(`${client.id} subscribed to fleet:${tenantId}`);
  }

  @SubscribeMessage('unsubscribe:fleet')
  handleUnsubscribeFleet(@ConnectedSocket() client: Socket) {
    const { tenantId } = (client.data ?? {}) as SocketData;
    if (tenantId) client.leave(`fleet:${tenantId}`);
  }

  @SubscribeMessage('driver:ping')
  async handleDriverPing(
    @MessageBody() data: LocationPingDto & { driverMembershipId: string; tenantId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Trust the authed tenant from the handshake, not the client-supplied field.
    const tenantId = (client.data as SocketData)?.tenantId ?? data.tenantId;
    const result = await this.locationService.ingestOne(data, tenantId);
    await this.processIngest(result);
  }

  /**
   * Shared post-ingest pipeline for both the socket and REST paths. Geofencing
   * and speed are evaluated for EVERY ping in the batch (so a stop passage or a
   * speed spike that happens mid-batch isn't skipped), while the live position
   * broadcast and next-stop ETA only reflect the newest fix.
   */
  async processIngest(result: IngestResult) {
    if (!result.latest) return; // nothing new (full-duplicate replay)
    this.broadcastLocation(result.latest);

    for (const pos of result.positions) {
      await this.runGeofence(pos);
      const alert = await this.speedService.evaluate(pos);
      if (alert) this.emitAlert(pos.tripId, pos.tenantId, alert);
    }

    const eta = await this.etaService.computeForNextStop(result.latest);
    if (eta) {
      this.emitEta(result.latest.tripId, {
        tripId: eta.tripId,
        stopId: eta.stopId,
        stopName: eta.stopName,
        etaMinutes: eta.etaMinutes,
        etaSeconds: eta.etaSeconds,
        distanceMeters: eta.distanceMeters,
        etaTs: eta.etaTs,
      });
      // Arrival alarms (PRD-03 §4.1). The next stop's ETA crossing ≤5 / ≤1 min
      // pushes a per-rider "~5 min" / "~1 min" alert. Dedup in the engine makes
      // each fire at most once per rider/stop/trip, so it's safe to (re)fire on
      // every qualifying ping. The AT_STOP "arrived" alert is wired in runGeofence.
      if (eta.etaMinutes <= 5) {
        this.dispatchArrival(
          eta.tripId,
          eta.stopId,
          eta.stopName,
          result.latest.tenantId,
          NotifCategory.ARRIVAL_5MIN,
        ).catch((err) =>
          this.logger.error(`ARRIVAL_5MIN dispatch failed: ${(err as Error).message}`),
        );
      }
      if (eta.etaMinutes <= 1) {
        this.dispatchArrival(
          eta.tripId,
          eta.stopId,
          eta.stopName,
          result.latest.tenantId,
          NotifCategory.ARRIVAL_1MIN,
        ).catch((err) =>
          this.logger.error(`ARRIVAL_1MIN dispatch failed: ${(err as Error).message}`),
        );
      }
    }
  }

  private async runGeofence(pos: LatestPosition) {
    const transitions = await this.geofenceService.evaluate(pos);
    for (const t of transitions) {
      this.server.to(`trip:${t.tripId}`).emit('trip:geofence', {
        tripId: t.tripId,
        stopId: t.stopId,
        stopName: t.stopName,
        event: t.event,
        ts: t.ts,
      });
      // Arrival alarm (PRD-03 §4.1, safety-critical): the bus has reached the
      // stop — tell the guardians of riders expected there. Fire-and-forget.
      if (t.event === 'AT_STOP') {
        this.dispatchArrival(
          t.tripId,
          t.stopId,
          t.stopName,
          pos.tenantId,
          NotifCategory.ARRIVED,
        ).catch((err) =>
          this.logger.error(`ARRIVED dispatch failed: ${(err as Error).message}`),
        );
      }
      // Surface geofence-driven not-boarded exceptions on the attendance feed.
      for (const r of t.notBoarded ?? []) {
        this.emitAttendance(t.tripId, {
          tripId: t.tripId,
          studentId: r.studentId,
          studentName: r.studentName,
          tenantId: pos.tenantId,
          type: 'NOT_BOARDED',
          ts: t.ts,
        });
        // Fire-and-forget: alert the child's guardians and tenant admins.
        this.dispatchNotBoarded(
          t.tripId,
          r.studentId,
          r.studentName,
          t.stopName,
          pos.tenantId,
        ).catch((err) =>
          this.logger.error(`NOT_BOARDED dispatch failed: ${(err as Error).message}`),
        );
      }
    }
  }

  /**
   * Resolve a not-boarded student's guardians + the tenant's admins and dispatch
   * an ALIGHTING notification (the closest NotifCategory for NOT_BOARDED).
   */
  private async dispatchNotBoarded(
    tripId: string,
    studentId: string,
    studentName: string,
    stopName: string,
    tenantId: string,
  ) {
    const [guardians, admins] = await Promise.all([
      this.prisma.guardianship.findMany({
        where: { studentId },
        select: { personId: true },
      }),
      this.prisma.membership.findMany({
        where: { tenantId, role: { in: ['ADMIN', 'TRANSPORT_MANAGER'] as never } },
        select: { personId: true },
      }),
    ]);
    const recipientIds = [
      ...new Set([
        ...guardians.map((g) => g.personId),
        ...admins.map((a) => a.personId),
      ]),
    ];
    if (!recipientIds.length) return;
    await this.notifications.dispatch({
      eventType: NotifCategory.ALIGHTING,
      tenantId,
      recipientIds,
      variables: { studentName, stopName: stopName ?? '', tripId, deepLink: `/track/${tripId}` },
      entityId: `notboarded:${tripId}:${studentId}`,
    });
  }

  /**
   * Per-rider arrival alarm (PRD-03 §4.1): resolve the guardians of every rider
   * whose boarding stop is `stopId` and dispatch the given arrival event. The
   * engine dedups per (eventType, trip, stop, guardian) so each guardian gets at
   * most one ~5-min / ~1-min / arrived ping per stop per trip. Riders who already
   * cancelled or missed the bus are excluded so parents aren't pinged needlessly.
   * Tenant isolation comes from the dispatch tenantId + the trip-scoped rider set.
   */
  private async dispatchArrival(
    tripId: string,
    stopId: string,
    stopName: string,
    tenantId: string,
    eventType: NotifCategory,
  ) {
    const riders = await this.prisma.tripRider.findMany({
      where: {
        tripId,
        stopId,
        boardStatus: { notIn: [RiderStatus.CANCELLED, RiderStatus.NOT_BOARDED] as never },
      },
      select: { studentId: true },
    });
    if (!riders.length) return;

    const guardians = await this.prisma.guardianship.findMany({
      where: { studentId: { in: riders.map((r) => r.studentId) } },
      select: { personId: true },
    });
    const recipientIds = [...new Set(guardians.map((g) => g.personId))];
    if (!recipientIds.length) return;

    await this.notifications.dispatch({
      eventType,
      tenantId,
      recipientIds,
      variables: { stopName: stopName ?? '', tripId, deepLink: `/track/${tripId}` },
      // (trip, stop) keys the dedup; eventType is already part of the engine's key.
      entityId: `${tripId}:${stopId}`,
    });
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
  emitTripStatus(tripId: string, tenantId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:status', payload);
    this.server.to(`fleet:${tenantId}`).emit('trip:status', payload);
  }

  emitAttendance(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:attendance', payload);
  }

  emitEta(tripId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('trip:eta', payload);
  }

  emitAlert(tripId: string, tenantId: string, payload: unknown) {
    this.server.to(`trip:${tripId}`).emit('alert:critical', payload);
    this.server.to(`fleet:${tenantId}`).emit('alert:critical', payload);
  }
}
