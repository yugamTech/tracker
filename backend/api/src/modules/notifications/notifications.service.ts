import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { NotifCategory, NotifChannel, NotifStatus } from '@saarthi/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { NOTIFICATION_EVENT_SPECS } from './notification-event.types';
import { FcmAdapter } from './fcm.adapter';

const PAGE_SIZE = 20;

export interface DispatchEvent {
  eventType: NotifCategory;
  tenantId: string;
  /** Already-resolved person IDs — recipient resolution happens at the call site. */
  recipientIds: string[];
  /** Template variables, e.g. { studentName, stopName, status, deepLink }. */
  variables: Record<string, string>;
  /** tripId / complaintId / invoiceId — the dedup key's entity component. */
  entityId: string;
}

export interface PreferenceUpdate {
  category: string;
  push?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly fcm: FcmAdapter,
  ) {}

  /**
   * Fan an event out to its recipients across the channels in its spec.
   *
   * Per recipient: dedup (Redis SET NX) → check preferences → write a PENDING
   * Notification row per channel → send (PUSH real, SMS/WhatsApp stubbed) →
   * mark SENT/FAILED. Designed to be called fire-and-forget; it never throws —
   * a failure for one recipient/channel is logged and the rest continue.
   */
  async dispatch(event: DispatchEvent): Promise<void> {
    const spec = NOTIFICATION_EVENT_SPECS[event.eventType];
    if (!spec) {
      this.logger.warn(`No notification spec for eventType=${event.eventType} — skipping dispatch.`);
      return;
    }

    const title = spec.title(event.variables);
    const body = spec.body(event.variables);
    const data: Record<string, string> = { ...event.variables, eventType: event.eventType };

    for (const recipientId of event.recipientIds) {
      try {
        // 1. Dedup: SET NX with the spec's TTL. If the key already exists, this
        //    (eventType, entityId, recipient) fired recently — skip the recipient.
        const dedupKey = `notif:dedup:${event.eventType}:${event.entityId}:${recipientId}`;
        const acquired = await this.redis.set(dedupKey, '1', 'PX', spec.dedupWindowMs, 'NX');
        if (acquired !== 'OK') continue;

        // 2. Preferences: default to all channels on when no row exists.
        const pref = await this.prisma.notificationPreference.findUnique({
          where: {
            personId_tenantId_category: {
              personId: recipientId,
              tenantId: event.tenantId,
              category: event.eventType,
            },
          },
        });

        for (const channel of spec.channels) {
          if (pref) {
            if (channel === NotifChannel.PUSH && !pref.push) continue;
            if (channel === NotifChannel.SMS && !pref.sms) continue;
            if (channel === NotifChannel.WHATSAPP && !pref.whatsapp) continue;
          }

          // 3. Record the attempt.
          const notif = await this.prisma.notification.create({
            data: {
              tenantId: event.tenantId,
              eventType: event.eventType,
              recipientId,
              channel: channel as never,
              status: NotifStatus.PENDING as never,
              templateId: spec.templateId,
              variables: event.variables,
              dedupKey,
            },
          });

          // 4. Deliver.
          if (channel === NotifChannel.PUSH) {
            const tokens = await this.prisma.deviceToken.findMany({
              where: { personId: recipientId },
              select: { token: true },
            });
            const result = await this.fcm.send(
              tokens.map((t) => t.token),
              title,
              body,
              data,
            );
            // Prune any tokens FCM rejected.
            for (const dead of result.invalidTokens ?? []) {
              await this.removeDeviceToken(dead);
            }
            await this.prisma.notification.update({
              where: { id: notif.id },
              data: {
                status: (result.success ? NotifStatus.SENT : NotifStatus.FAILED) as never,
                sentAt: result.success ? new Date() : null,
              },
            });
          } else {
            // SMS / WhatsApp are stubbed until DLT/BSP templates are approved.
            this.logger.warn(`${channel} stub — not wired (notification ${notif.id}).`);
            await this.prisma.notification.update({
              where: { id: notif.id },
              data: { status: NotifStatus.FAILED as never },
            });
          }
        }
      } catch (err) {
        this.logger.error(
          `dispatch failed for recipient=${recipientId} eventType=${event.eventType}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ── Feed ──────────────────────────────────────────────────────────────────

  listForPerson(personId: string, tenantId: string, page = 1) {
    const p = Math.max(1, page);
    return this.prisma.notification.findMany({
      where: { recipientId: personId, tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
  }

  async markRead(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(personId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: personId, tenantId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ── Device tokens ───────────────────────────────────────────────────────────

  registerDeviceToken(personId: string, token: string, platform: string) {
    // token is unique — upsert so re-registering the same token just re-points it.
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { personId, token, platform },
      update: { personId, platform },
    });
  }

  async removeDeviceToken(token: string): Promise<void> {
    // deleteMany so pruning an already-gone token is a no-op, not a throw.
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  // ── Preferences ─────────────────────────────────────────────────────────────

  getPreferences(personId: string, tenantId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { personId, tenantId },
    });
  }

  async updatePreferences(
    personId: string,
    tenantId: string,
    updates: PreferenceUpdate[],
  ) {
    const results = [];
    for (const u of updates) {
      if (!u.category) continue;
      const row = await this.prisma.notificationPreference.upsert({
        where: {
          personId_tenantId_category: { personId, tenantId, category: u.category },
        },
        create: {
          personId,
          tenantId,
          category: u.category,
          push: u.push ?? true,
          sms: u.sms ?? true,
          whatsapp: u.whatsapp ?? true,
        },
        update: {
          ...(u.push !== undefined && { push: u.push }),
          ...(u.sms !== undefined && { sms: u.sms }),
          ...(u.whatsapp !== undefined && { whatsapp: u.whatsapp }),
        },
      });
      results.push(row);
    }
    return results;
  }
}
