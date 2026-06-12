import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '@saarthi/types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccess(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  signRefresh(payload: Pick<JwtPayload, 'sub' | 'membershipId' | 'tenantId' | 'role'>): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });
  }

  verify(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get<string>('JWT_SECRET'),
    });
  }
}
