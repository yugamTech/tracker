import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface FcmSendResult {
  success: boolean;
  /** true when FCM is disabled (no service account) or there was nothing to send. */
  skipped?: boolean;
  /** Tokens FCM rejected as unregistered/invalid — caller should prune these. */
  invalidTokens?: string[];
}

/**
 * Thin wrapper around firebase-admin.
 *
 * Dev-safe: if FCM_SERVICE_ACCOUNT_JSON is absent/empty/malformed, we log one
 * warning at startup and every send() becomes a no-op ({ success: false,
 * skipped: true }). The app never crashes for lack of FCM credentials.
 *
 * Token pruning: send() does NOT touch the DB. It returns invalidTokens and the
 * NotificationsService prunes them via removeDeviceToken — this keeps the adapter
 * free of a circular dependency on the service.
 */
@Injectable()
export class FcmAdapter implements OnModuleInit {
  private readonly logger = new Logger(FcmAdapter.name);
  private enabled = false;

  onModuleInit() {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!raw || !raw.trim()) {
      this.logger.warn(
        'FCM_SERVICE_ACCOUNT_JSON not set — FCM disabled; all push sends will no-op.',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      // Guard initializeApp: firebase-admin throws on a duplicate default app.
      // NotificationsService is a singleton, but this adapter could in theory be
      // constructed more than once across test/HMR boundaries, so we check the
      // app registry rather than trusting Nest's singleton scope alone.
      if (getApps().length === 0) {
        initializeApp({ credential: cert(serviceAccount) });
      }
      this.enabled = true;
      this.logger.log('FCM initialized.');
    } catch (err) {
      this.logger.warn(
        `FCM init failed (${(err as Error).message}) — push disabled; sends will no-op.`,
      );
    }
  }

  async send(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string> = {},
  ): Promise<FcmSendResult> {
    if (!this.enabled) return { success: false, skipped: true };
    if (!tokens.length) return { success: false, skipped: true };

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[i]);
      }
    });

    return { success: response.successCount > 0, invalidTokens };
  }
}
