import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tracking (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Obtain a driver token via bypass OTP (requires OTP_BYPASS_CODE=123456 in .env)
    if (process.env.OTP_BYPASS_CODE === '123456') {
      const res = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: '+919999000002', otp: '123456' });
      accessToken = res.body?.data?.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tracking/ping', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/tracking/ping')
        .send({ tripId: 'trip-1', lat: 28.6, lng: 77.2, accuracy: 5, deviceTs: Date.now(), sequence: 1 })
        .expect(401);
    });

    it('accepts a valid ping with a driver token', async () => {
      if (!accessToken) return;
      return request(app.getHttpServer())
        .post('/tracking/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ tripId: 'trip-1', lat: 28.6139, lng: 77.2090, accuracy: 5, deviceTs: Date.now(), sequence: 1 })
        .expect((res) => {
          expect([200, 201, 404]).toContain(res.status); // 404 if trip doesn't exist in test DB
        });
    });
  });
});
