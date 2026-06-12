import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/otp/request', () => {
    it('returns 201 for a valid phone number', () => {
      return request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ phone: '+919999000001' })
        .expect(201);
    });

    it('returns 400 for an invalid phone number', () => {
      return request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ phone: 'not-a-phone' })
        .expect(400);
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('returns 401 for a wrong OTP', () => {
      return request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: '+919999000001', otp: '000000' })
        .expect(401);
    });

    it('returns tokens for bypass OTP in dev', async () => {
      if (process.env.OTP_BYPASS_CODE !== '123456') return;

      const res = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: '+919999000001', otp: '123456' })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 401 for an invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });
  });
});
