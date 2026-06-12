import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { randomInt } from 'crypto';

@Injectable()
export class OtpService {
  private readonly expiry: number;
  private readonly length: number;
  private readonly bypassMode: boolean;
  private readonly bypassCode: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.expiry = config.get<number>('OTP_EXPIRY_SECONDS', 300);
    this.length = config.get<number>('OTP_LENGTH', 6);
    this.bypassMode = config.get<string>('OTP_BYPASS_MODE', 'false') === 'true';
    this.bypassCode = config.get<string>('OTP_BYPASS_CODE', '123456');
  }

  async generate(phone: string): Promise<string> {
    const otp = this.bypassMode
      ? this.bypassCode
      : String(randomInt(10 ** (this.length - 1), 10 ** this.length));

    await this.redis.setex(`otp:${phone}`, this.expiry, otp);
    return otp;
  }

  async verify(phone: string, otp: string): Promise<boolean> {
    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== otp) return false;
    await this.redis.del(`otp:${phone}`);
    return true;
  }

  async send(phone: string, otp: string): Promise<void> {
    if (this.bypassMode) {
      console.warn(`[OTP BYPASS] Phone: ${phone}, OTP: ${otp}`);
      return;
    }
    // TODO: integrate SMS provider (Gupshup / Twilio)
    console.warn(`[OTP] Would send OTP ${otp} to ${phone}`);
  }
}
