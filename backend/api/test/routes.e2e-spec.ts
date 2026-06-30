/**
 * Routes — direction-agnostic scheduling + unique name per tenant (e2e).
 *
 * A route no longer carries a direction (Route.direction was dropped); the
 * direction lives on each Trip. This suite seeds one tenant with a route, stop,
 * vehicle, driver and an active student, authenticates as the admin via OTP
 * bypass, then asserts:
 *   - ITEM 2: scheduling a PICKUP trip AND a DROP trip on the SAME route both
 *     succeed (201) — one route serves both directions.
 *   - ITEM 3: creating a second route with a name already used in the tenant → 409.
 *
 * Requires OTP_BYPASS_MODE=true + OTP_BYPASS_CODE=123456 (set in CI / the e2e run).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Phone prefix unique to this file → `${PH}10` = +919903000010 (valid IN mobile).
const PH = '+9199030000';

describe('Routes — direction-agnostic + unique name (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAdmin: string;
  let routeId: string;
  let vehicleId: string;
  let driverPersonId: string;

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

  // A day ~3 days out so the scheduledStart is comfortably inside the
  // [now, +1 month] scheduling window regardless of the current time.
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

    const tenant = await prisma.tenant.create({ data: { name: 'ROUTE Test A' } });
    created.tenantIds.push(tenant.id);

    const pAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAdmin.id);
    const mAdmin = await prisma.membership.create({
      data: { personId: pAdmin.id, tenantId: tenant.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAdmin.id);

    const pDriver = await prisma.person.create({ data: { phone: `${PH}11`, name: 'Driver A' } });
    created.personIds.push(pDriver.id);
    driverPersonId = pDriver.id;
    const mDriver = await prisma.membership.create({
      data: { personId: pDriver.id, tenantId: tenant.id, role: 'DRIVER', status: 'ACTIVE' },
    });
    created.membershipIds.push(mDriver.id);

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: tenant.id, regNumber: 'KA01ROUTE', capacity: 40, status: 'ACTIVE' },
    });
    created.vehicleIds.push(vehicle.id);
    vehicleId = vehicle.id;

    const route = await prisma.route.create({
      data: { tenantId: tenant.id, name: 'Both-Ways Route' },
    });
    created.routeIds.push(route.id);
    routeId = route.id;

    const stop = await prisma.stop.create({
      data: { tenantId: tenant.id, name: 'Route Stop A', lat: 12.9, lng: 77.6 },
    });
    created.stopIds.push(stop.id);
    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });

    const ageGroup = await prisma.ageGroup.create({
      data: { tenantId: tenant.id, name: 'All-day', pickupTime: '07:00', dropTime: '14:00', routeId: route.id },
    });
    created.ageGroupIds.push(ageGroup.id);

    const student = await prisma.student.create({
      data: { tenantId: tenant.id, name: 'Rider Kid', ageGroupId: ageGroup.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student.id);

    if (process.env.OTP_BYPASS_CODE === '123456') {
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}10` });
      const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone: `${PH}10`, otp: '123456' });
      tokenAdmin = res.body?.data?.accessToken;
    }
    if (process.env.OTP_BYPASS_CODE === '123456' && !tokenAdmin) {
      throw new Error('e2e setup: OTP bypass enabled but admin token not obtained — tests would vacuously skip.');
    }
  });

  afterAll(async () => {
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
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

  // ── ITEM 2 — one route serves both directions ──────────────────────────────
  describe('POST /trips — same route, both directions', () => {
    it('schedules a PICKUP trip on the route (201)', async () => {
      if (!tokenAdmin) return;
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          routeId,
          vehicleId,
          driverId: driverPersonId,
          date: scheduledStartFor(7).toISOString(),
          direction: 'PICKUP',
          scheduledStart: scheduledStartFor(7).toISOString(),
        })
        .expect(201);
      expect(res.body.data.direction).toBe('PICKUP');
      expect(res.body.data.routeId).toBe(routeId);
      created.tripIds.push(res.body.data.id);
    });

    it('schedules a DROP trip on the SAME route (201)', async () => {
      if (!tokenAdmin) return;
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          routeId,
          vehicleId,
          driverId: driverPersonId,
          date: scheduledStartFor(14).toISOString(),
          direction: 'DROP',
          scheduledStart: scheduledStartFor(14).toISOString(),
        })
        .expect(201);
      expect(res.body.data.direction).toBe('DROP');
      expect(res.body.data.routeId).toBe(routeId);
      created.tripIds.push(res.body.data.id);
    });
  });

  // ── ITEM 3 — unique route name per tenant ──────────────────────────────────
  describe('POST /routes — unique name per tenant', () => {
    it('rejects a duplicate route name with 409', async () => {
      if (!tokenAdmin) return;
      // 'Both-Ways Route' was seeded above in this tenant.
      const res = await request(app.getHttpServer())
        .post('/routes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ name: 'Both-Ways Route' })
        .expect(409);
      expect(String(res.body.error?.message ?? res.body.message)).toMatch(/already exists/i);
    });

    it('allows a distinct route name (201)', async () => {
      if (!tokenAdmin) return;
      const res = await request(app.getHttpServer())
        .post('/routes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ name: 'A Different Route' })
        .expect(201);
      expect(res.body.data.id).toBeDefined();
      created.routeIds.push(res.body.data.id);
    });
  });
});
