import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { Role } from '@saarthi/types';
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

    // Find or create person
    let person = await this.prisma.person.findUnique({
      where: { phone: dto.phone },
    });

    if (!person) {
      person = await this.prisma.person.create({
        data: { phone: dto.phone, name: dto.phone },
      });
    }

    // Get active memberships
    const memberships = await this.prisma.membership.findMany({
      where: { personId: person.id, status: 'ACTIVE' },
      include: { tenant: { select: { name: true } } },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('No active membership found for this number');
    }

    // Use first membership by default (context-switch handles multi-tenant)
    const membership = memberships[0];

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
      memberships: memberships.map((m: any) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.tokenService.verify(refreshToken);
      const newPayload = {
        sub: payload.sub,
        membershipId: payload.membershipId,
        tenantId: payload.tenantId,
        role: payload.role,
      };
      return {
        accessToken: this.tokenService.signAccess(newPayload),
        refreshToken: this.tokenService.signRefresh(newPayload),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
