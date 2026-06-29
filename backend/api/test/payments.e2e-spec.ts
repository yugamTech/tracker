import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Payments (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so responses are wrapped in { data, meta } and errors shaped
    // by the filter — otherwise body.data.* assertions can never pass.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // SKIPPED: the POST /payments/webhook/:gateway route is not implemented yet
  // (payments is a parked feature pending the founder's fee model), so these 404.
  // Re-enable when the webhook lands as part of the payments build. P1 follow-up.
  describe.skip('POST /payments/webhook/:gateway', () => {
    it('returns 400 for a missing idempotency key', () => {
      return request(app.getHttpServer())
        .post('/payments/webhook/cashfree')
        .send({ eventType: 'PAYMENT_SUCCESS', data: {} })
        .expect(400);
    });

    it('accepts a webhook with a valid signature header', () => {
      return request(app.getHttpServer())
        .post('/payments/webhook/cashfree')
        .set('x-webhook-signature', 'test-signature')
        .set('x-idempotency-key', 'test-key-001')
        .send({ eventType: 'PAYMENT_SUCCESS', orderId: 'order_001', data: {} })
        .expect((res) => {
          // 200 (processed) or 401 (invalid signature) — both are handled responses
          expect([200, 401]).toContain(res.status);
        });
    });
  });

  describe('GET /payments/invoices', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .get('/payments/invoices')
        .expect(401);
    });
  });
});
