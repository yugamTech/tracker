/**
 * Skip-pickup direction guard (e2e) — ITEM 7.
 *
 * A parent can skip a PICKUP (don't collect my child this morning) but never a
 * DROP — a child already at school still needs to get home. Seeds one tenant with
 * a route, stop, shift, an ACTIVE student, a vehicle and a driver, schedules a
 * PICKUP trip and a DROP trip on that route (the student is an EXPECTED rider on
 * both), authenticates as the admin via OTP bypass, then asserts:
 *   - cancel-pickup on the DROP trip → 400 ("a drop cannot be skipped")
 *   - cancel-pickup on the PICKUP trip → 201 (still works)
 *
 * Requires OTP_BYPASS_MODE=true + OTP_BYPASS_CODE=123456.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Phone prefix unique to this file → `${PH}10` = +919904000010.
const PH = '+9199040000';

describe('Skip-pickup direction guard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAdmin: string;
  let studentId: string;
  let pickupTripId: string;
  let dropTripId: string;

  const created = {
    tenantIds: [] as string[],
    personIds: [] as string[],
    membershipIds: [] as string[],
    vehicleIds: [] as string[],
    routeIds: [] as string[],
    stopIds: [] as string[],
    ageGroupIds: [] as string[],
    studentIds: [] as string[],
    tripIds: [] as string[],
  };

  const scheduledStartFor = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);

    const tenant = await prisma.tenant.create({ data: { name: 'SKIP Test A' } });
    created.tenantIds.push(tenant.id);

    const pAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAdmin.id);
    const mAdmin = await prisma.membership.create({
      data: { personId: pAdmin.id, tenantId: tenant.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAdmin.id);

    const pDriver = await prisma.person.create({ data: { phone: `${PH}11`, name: 'Driver A' } });
    created.personIds.push(pDriver.id);
    const mDriver = await prisma.membership.create({
      data: { personId: pDriver.id, tenantId: tenant.id, role: 'DRIVER', status: 'ACTIVE' },
    });
    created.membershipIds.push(mDriver.id);

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: tenant.id, regNumber: 'KA01SKIP', capacity: 40, status: 'ACTIVE' },
    });
    created.vehicleIds.push(vehicle.id);

    const route = await prisma.route.create({ data: { tenantId: tenant.id, name: 'Skip Route' } });
    created.routeIds.push(route.id);

    const stop = await prisma.stop.create({
      data: { tenantId: tenant.id, name: 'Skip Stop', lat: 12.9, lng: 77.6 },
    });
    created.stopIds.push(stop.id);
    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });

    const ageGroup = await prisma.ageGroup.create({
      data: { tenantId: tenant.id, name: 'All-day', pickupTime: '07:00', dropTime: '14:00', routeId: route.id },
    });
    created.ageGroupIds.push(ageGroup.id);

    const student = await prisma.student.create({
      data: { tenantId: tenant.id, name: 'Skip Kid', ageGroupId: ageGroup.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student.id);
    studentId = student.id;

    if (process.env.OTP_BYPASS_CODE === '123456') {
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}10` });
      const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone: `${PH}10`, otp: '123456' });
      tokenAdmin = res.body?.data?.accessToken;
    }
    if (process.env.OTP_BYPASS_CODE === '123456' && !tokenAdmin) {
      throw new Error('e2e setup: OTP bypass enabled but admin token not obtained — tests would vacuously skip.');
    }

    if (tokenAdmin) {
      const mk = async (direction: 'PICKUP' | 'DROP', hour: number) => {
        const res = await request(app.getHttpServer())
          .post('/trips')
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({
            routeId: route.id,
            vehicleId: vehicle.id,
            driverId: pDriver.id,
            date: scheduledStartFor(hour).toISOString(),
            direction,
            scheduledStart: scheduledStartFor(hour).toISOString(),
          })
          .expect(201);
        created.tripIds.push(res.body.data.id);
        return res.body.data.id as string;
      };
      pickupTripId = await mk('PICKUP', 7);
      dropTripId = await mk('DROP', 14);
    }
  });

  afterAll(async () => {
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
    await swallow(prisma.pickupCancellation.deleteMany({ where: { tripId: { in: created.tripIds } } }));
    await swallow(prisma.tripRider.deleteMany({ where: { tripId: { in: created.tripIds } } }));
    await swallow(prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } }));
    await swallow(prisma.student.deleteMany({ where: { id: { in: created.studentIds } } }));
    await swallow(prisma.routeStop.deleteMany({ where: { routeId: { in: created.routeIds } } }));
    await swallow(prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } }));
    await swallow(prisma.ageGroup.deleteMany({ where: { id: { in: created.ageGroupIds } } }));
    await swallow(prisma.route.deleteMany({ where: { id: { in: created.routeIds } } }));
    await swallow(prisma.vehicle.deleteMany({ where: { id: { in: created.vehicleIds } } }));
    await swallow(prisma.membership.deleteMany({ where: { id: { in: created.membershipIds } } }));
    await swallow(prisma.person.deleteMany({ where: { id: { in: created.personIds } } }));
    await swallow(prisma.tenant.deleteMany({ where: { id: { in: created.tenantIds } } }));
    await app.close();
  });

  describe('POST /trips/:id/cancel-pickup', () => {
    it('rejects skipping a DROP with 400', async () => {
      if (!tokenAdmin) return;
      const res = await request(app.getHttpServer())
        .post(`/trips/${dropTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ studentId })
        .expect(400);
      expect(String(res.body.error?.message ?? res.body.message)).toMatch(/drop cannot be skipped/i);
    });

    it('allows skipping a PICKUP (201)', async () => {
      if (!tokenAdmin) return;
      const res = await request(app.getHttpServer())
        .post(`/trips/${pickupTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ studentId })
        .expect(201);
      expect(res.body.data.cutoff?.canCancel).toBe(true);
    });
  });
});
