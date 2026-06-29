import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { Role } from '@yaanam/types';
import type { RequestOtpDto } from './dto/request-otp.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const otp = await this.otpService.generate(dto.phone);
    await this.otpService.send(dto.phone, otp);
    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const valid = await this.otpService.verify(dto.phone, dto.otp);
    if (!valid) throw new UnauthorizedException('Invalid or expired OTP');

    // Anti-self-signup (PRD-01 FR-03): identity is provisioned, never created at
    // login. An unknown number is refused — we don't mint an orphan Person.
    const person = await this.prisma.person.findUnique({
      where: { phone: dto.phone },
    });
    if (!person) {
      throw new UnauthorizedException(
        "This number isn't registered with any school yet. Contact your school admin.",
      );
    }

    // Get active memberships
    const memberships = await this.prisma.membership.findMany({
      where: { personId: person.id, status: 'ACTIVE' },
      include: { tenant: { select: { name: true } } },
    });

    // Role-aware login: each app passes the roles it serves. One person may hold
    // many roles (one identity, many memberships — PRD-01 §2), but an app only
    // admits memberships whose role it serves, so e.g. a parent can never land in
    // the driver app. Omitting allowedRoles keeps the unrestricted behaviour.
    const eligible = dto.allowedRoles?.length
      ? memberships.filter((m) => dto.allowedRoles!.includes(m.role))
      : memberships;

    if (eligible.length === 0) {
      // No ACTIVE membership this app will admit. Before the generic rejections,
      // distinguish a *deactivated* member of this app: a number that DID have
      // access for one of this app's roles but whose membership is now non-ACTIVE
      // (SUSPENDED). They should be told their access/subscription is inactive —
      // not that they're unknown — so the app can route them to a re-subscribe /
      // contact-admin screen. A truly-unknown number keeps the existing behaviour.
      if (dto.allowedRoles?.length) {
        const inactiveForApp = await this.prisma.membership.findFirst({
          where: {
            personId: person.id,
            role: { in: dto.allowedRoles as Role[] },
            status: { not: 'ACTIVE' },
          },
          select: { id: true },
        });
        if (inactiveForApp) {
          throw new ForbiddenException({
            error: 'MEMBERSHIP_INACTIVE',
            message:
              'Your access at this school is inactive. Please contact your school to restore it.',
          });
        }
      }

      if (memberships.length === 0) {
        throw new UnauthorizedException(
          "This number isn't registered with any school yet. Contact your school admin.",
        );
      }
      throw new ForbiddenException(
        `This number is registered, but not for this app (needs one of: ${dto.allowedRoles!.join(', ')}).`,
      );
    }

    // Use the first eligible membership by default (context-switch handles multi-tenant).
    const membership = eligible[0];

    const payload = {
      sub: person.id,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      role: membership.role as Role,
    };

    return {
      accessToken: this.tokenService.signAccess(payload),
      refreshToken: this.tokenService.signRefresh(payload),
      person: { id: person.id, phone: person.phone, name: person.name },
      memberships: eligible.map((m: any) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  async listMemberships(personId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { personId, status: 'ACTIVE' },
      include: { tenant: { select: { name: true } } },
    });
    return memberships.map((m: any) => ({
      id: m.id,
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      role: m.role,
    }));
  }

  async switchContext(personId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirstOrThrow({
      where: { id: membershipId, personId, status: 'ACTIVE' },
      include: { tenant: { select: { name: true } } },
    });
    const payload = {
      sub: personId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      role: membership.role as Role,
    };
    return {
      accessToken: this.tokenService.signAccess(payload),
      refreshToken: this.tokenService.signRefresh(payload),
      membership: {
        id: membership.id,
        tenantId: membership.tenantId,
        tenantName: (membership as any).tenant.name,
        role: membership.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: ReturnType<typeof this.tokenService.verify>;
    try {
      payload = this.tokenService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Re-validate the membership on every refresh: a deactivated/suspended user (or
    // a membership revoked after sign-in) must NOT keep minting access tokens for
    // the refresh token's 30-day life. Re-deriving role/tenant from the DB also
    // means a role change takes effect on the next refresh instead of persisting
    // stale claims for up to 30 days.
    const membership = await this.prisma.membership.findFirst({
      where: { id: payload.membershipId, personId: payload.sub, status: 'ACTIVE' },
      select: { id: true, tenantId: true, role: true },
    });
    if (!membership) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const newPayload = {
      sub: payload.sub,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      role: membership.role as Role,
    };
    return {
      accessToken: this.tokenService.signAccess(newPayload),
      refreshToken: this.tokenService.signRefresh(newPayload),
    };
  }
}
