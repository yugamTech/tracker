import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { NotifCategory, ComplaintStatus } from '@yaanam/types';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Roles that further-action escalation targets, in order of preference. */
const HIGHER_AUTHORITY_ROLES = ['FOUNDER', 'SUPER_ADMIN'];
const FALLBACK_AUTHORITY_ROLES = ['ADMIN', 'TRANSPORT_MANAGER'];

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The parent's satisfaction step. Records the rating (1–5 + explicit
   * satisfied/not + optional comment) on a RESOLVED complaint, then advances the
   * lifecycle and keeps the ComplaintEvent audit trail:
   *
   *  - satisfied     → status PARENT_RATING (awaiting the admin's close).
   *  - not satisfied → status REOPENED and escalate to higher authority
   *    (FOUNDER/SUPER_ADMIN, else ADMIN/TRANSPORT_MANAGER) so they can act.
   *
   * Only the guardian who raised the complaint may rate it. Re-rating (e.g. after
   * a reopened complaint is resolved again) upserts the single 1:1 row.
   */
  async submitResolutionRating(params: {
    complaintId: string;
    tenantId: string;
    personId: string;
    rating: number;
    satisfied: boolean;
    comment?: string;
  }) {
    const { complaintId, tenantId, personId, rating, satisfied, comment } = params;

    // Tenant-scoped: a complaint id from another tenant must 404, never resolve.
    const complaint = await this.prisma.complaint.findFirstOrThrow({
      where: { id: complaintId, tenantId },
    });

    if (complaint.raisedBy !== personId) {
      throw new ForbiddenException('You can only rate the resolution of a complaint you raised.');
    }
    if (complaint.status !== ComplaintStatus.RESOLVED) {
      throw new BadRequestException(
        `This complaint is not awaiting a resolution rating (status: ${complaint.status}).`,
      );
    }

    const newStatus = satisfied ? ComplaintStatus.PARENT_RATING : ComplaintStatus.REOPENED;
    const eventNote = `Parent rated ${rating}★ — ${satisfied ? 'satisfied' : 'NOT satisfied'}${
      comment ? `: ${comment}` : ''
    }`;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.resolutionRating.upsert({
        where: { complaintId },
        // `?? null` so re-rating (after a reopen→resolve) can clear a prior comment.
        create: { complaintId, ratedBy: personId, rating, satisfied, comment: comment ?? null },
        update: { ratedBy: personId, rating, satisfied, comment: comment ?? null, ts: new Date() },
      }),
      this.prisma.complaint.update({
        where: { id: complaintId },
        data: { status: newStatus as never },
      }),
      this.prisma.complaintEvent.create({
        data: {
          complaintId,
          actor: personId,
          fromStatus: ComplaintStatus.RESOLVED as never,
          toStatus: newStatus as never,
          note: eventNote,
        },
      }),
    ]);

    // Not satisfied → escalate to higher authority (fire-and-forget, never throws).
    if (!satisfied) {
      this.escalate(complaint.id, complaint.tenantId, complaint.category, rating, comment).catch((err) =>
        this.logger.error(`COMPLAINT_ESCALATED dispatch failed: ${(err as Error).message}`),
      );
    }

    return updated;
  }

  /** Resolve the higher-authority recipients (with fallback) and dispatch the escalation. */
  private async escalate(
    complaintId: string,
    tenantId: string,
    category: string,
    rating: number,
    comment?: string,
  ): Promise<void> {
    let recipients = await this.prisma.membership.findMany({
      where: { tenantId, role: { in: HIGHER_AUTHORITY_ROLES as never }, status: 'ACTIVE' },
      select: { personId: true },
    });
    if (!recipients.length) {
      recipients = await this.prisma.membership.findMany({
        where: { tenantId, role: { in: FALLBACK_AUTHORITY_ROLES as never }, status: 'ACTIVE' },
        select: { personId: true },
      });
    }
    const recipientIds = [...new Set(recipients.map((r) => r.personId))];
    if (!recipientIds.length) {
      this.logger.warn(`No escalation recipient for complaint ${complaintId} in tenant ${tenantId}.`);
      return;
    }
    await this.notifications.dispatch({
      eventType: NotifCategory.COMPLAINT_ESCALATED,
      tenantId,
      recipientIds,
      variables: {
        complaintId,
        category,
        rating: String(rating),
        deepLink: `/complaints/${complaintId}`,
        ...(comment && { comment }),
      },
      entityId: complaintId,
    });
  }
}
