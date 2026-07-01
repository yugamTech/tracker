/**
 * Bus-condition photos on the daily pre-trip check (e2e) — ITEM 9.
 *
 * A driver may attach bus-condition photos to their pre-trip check; an admin sees
 * them on the vehicle; a parent sees only the photos for the vehicle on THEIR
 * child's trip, and only from the last 30 days. Seeds one tenant with a route/stop,
 * an ACTIVE student on the route, a vehicle + driver, a PARENT who guards that
 * student, and a SECOND parent who guards a different student NOT on the trip.
 * Schedules a near-future PICKUP (student is an EXPECTED rider). Asserts:
 *   - driver POST /daily-checks with photoUrls persists them (201)
 *   - admin GET /daily-checks?vehicleId sees the photoUrls
 *   - parent GET /daily-checks/trip/:id/bus-photos returns the recent photos, and
 *     a >30-day-old check is excluded (retention rule)
 *   - a parent who guards no child on the trip is refused (404)
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

// Phone prefix unique to this file → `${PH}10` = +919904200010.
const PH = '+9199042000';
const RECENT_PHOTO = '/uploads/attendance/daily-checks/bus-recent.jpg';
const OLD_PHOTO = '/uploads/attendance/daily-checks/bus-old-should-not-appear.jpg';

describe('Daily-check bus-condition photos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAdmin: string;
  let tokenParent: string;
  let tokenOtherParent: string;
  let tokenDriver: string;
  let tripId: string;
  let vehicleId: string;

  const created = {
    tenantIds: [] as string[],
    personIds: [] as string[],
    membershipIds: [] as string[],
    vehicleIds: [] as string[],
    routeIds: [] as string[],
    stopIds: [] as string[],
    ageGroupIds: [] as string[],
    studentIds: [] as string[],
    guardianshipIds: [] as string[],
    tripIds: [] as string[],
    dailyCheckIds: [] as string[],
  };

  const soon = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d;
  };

  const getToken = async (phone: string) => {
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone });
    const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone, otp: '123456' });
    return res.body?.data?.accessToken as string;
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);

    const tenant = await prisma.tenant.create({ data: { name: 'CHK Test A' } });
    created.tenantIds.push(tenant.id);

    const pAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAdmin.id);
    created.membershipIds.push(
      (await prisma.membership.create({ data: { personId: pAdmin.id, tenantId: tenant.id, role: 'ADMIN', status: 'ACTIVE' } })).id,
    );

    const pDriver = await prisma.person.create({ data: { phone: `${PH}11`, name: 'Driver A' } });
    created.personIds.push(pDriver.id);
    created.membershipIds.push(
      (await prisma.membership.create({ data: { personId: pDriver.id, tenantId: tenant.id, role: 'DRIVER', status: 'ACTIVE' } })).id,
    );

    const pParent = await prisma.person.create({ data: { phone: `${PH}12`, name: 'Parent A' } });
    created.personIds.push(pParent.id);
    created.membershipIds.push(
      (await prisma.membership.create({ data: { personId: pParent.id, tenantId: tenant.id, role: 'PARENT', status: 'ACTIVE' } })).id,
    );

    const pOther = await prisma.person.create({ data: { phone: `${PH}13`, name: 'Parent B' } });
    created.personIds.push(pOther.id);
    created.membershipIds.push(
      (await prisma.membership.create({ data: { personId: pOther.id, tenantId: tenant.id, role: 'PARENT', status: 'ACTIVE' } })).id,
    );

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: tenant.id, regNumber: 'KA01CHK', capacity: 40, status: 'ACTIVE' },
    });
    vehicleId = vehicle.id;
    created.vehicleIds.push(vehicle.id);

    const route = await prisma.route.create({ data: { tenantId: tenant.id, name: 'Check Route' } });
    created.routeIds.push(route.id);
    const stop = await prisma.stop.create({ data: { tenantId: tenant.id, name: 'Check Stop', lat: 12.9, lng: 77.6 } });
    created.stopIds.push(stop.id);
    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });

    const ageGroup = await prisma.ageGroup.create({
      data: { tenantId: tenant.id, name: 'All-day', pickupTime: '07:00', dropTime: '14:00', routeId: route.id },
    });
    created.ageGroupIds.push(ageGroup.id);

    // student1 rides the trip (on the route); student2 does NOT (no route).
    const student1 = await prisma.student.create({
      data: { tenantId: tenant.id, name: 'Rider Kid', ageGroupId: ageGroup.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student1.id);
    const student2 = await prisma.student.create({
      data: { tenantId: tenant.id, name: 'Other Kid', ageGroupId: ageGroup.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student2.id);

    created.guardianshipIds.push(
      (await prisma.guardianship.create({ data: { studentId: student1.id, personId: pParent.id, relation: 'parent', isPrimary: true } })).id,
    );
    created.guardianshipIds.push(
      (await prisma.guardianship.create({ data: { studentId: student2.id, personId: pOther.id, relation: 'parent', isPrimary: true } })).id,
    );

    if (process.env.OTP_BYPASS_CODE === '123456') {
      tokenAdmin = await getToken(`${PH}10`);
      tokenDriver = await getToken(`${PH}11`);
      tokenParent = await getToken(`${PH}12`);
      tokenOtherParent = await getToken(`${PH}13`);
    }
    if (process.env.OTP_BYPASS_CODE === '123456' && (!tokenAdmin || !tokenDriver || !tokenParent || !tokenOtherParent)) {
      throw new Error('e2e setup: OTP bypass enabled but tokens not obtained — tests would vacuously skip.');
    }

    if (tokenAdmin) {
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          routeId: route.id,
          vehicleId: vehicle.id,
          driverId: pDriver.id,
          date: soon().toISOString(),
          direction: 'PICKUP',
          scheduledStart: soon().toISOString(),
        })
        .expect(201);
      tripId = res.body.data.id;
      created.tripIds.push(tripId);

      // A >30-day-old check with a photo on the SAME vehicle — must be excluded
      // from the parent-facing 30-day window.
      const old = await prisma.dailyCheck.create({
        data: {
          tenantId: tenant.id,
          vehicleId: vehicle.id,
          submittedById: pDriver.id,
          items: { tyres: true },
          photoUrls: [OLD_PHOTO],
          createdAt: new Date(Date.now() - 40 * 24 * 60 * 60_000),
        },
      });
      created.dailyCheckIds.push(old.id);
    }
  });

  afterAll(async () => {
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
    await swallow(prisma.dailyCheck.deleteMany({ where: { vehicleId: { in: created.vehicleIds } } }));
    await swallow(prisma.tripRider.deleteMany({ where: { tripId: { in: created.tripIds } } }));
    await swallow(prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } }));
    await swallow(prisma.guardianship.deleteMany({ where: { id: { in: created.guardianshipIds } } }));
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

  it('driver saves a check WITH photos and they persist (201)', async () => {
    if (!tokenDriver) return;
    const res = await request(app.getHttpServer())
      .post('/daily-checks')
      .set('Authorization', `Bearer ${tokenDriver}`)
      .send({
        vehicleId,
        tripId,
        items: { tyres: true, brakes: true },
        note: 'Small scratch on rear door',
        photoUrls: [RECENT_PHOTO],
      })
      .expect(201);
    created.dailyCheckIds.push(res.body.data.id);
    expect(res.body.data.photoUrls).toEqual([RECENT_PHOTO]);
  });

  it('admin sees the photos on the vehicle', async () => {
    if (!tokenAdmin) return;
    const res = await request(app.getHttpServer())
      .get(`/daily-checks?vehicleId=${vehicleId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const withRecent = res.body.data.find((c: any) => c.photoUrls?.includes(RECENT_PHOTO));
    expect(withRecent).toBeTruthy();
  });

  it('parent sees only the last-30-days photos for their child’s vehicle', async () => {
    if (!tokenParent) return;
    const res = await request(app.getHttpServer())
      .get(`/daily-checks/trip/${tripId}/bus-photos`)
      .set('Authorization', `Bearer ${tokenParent}`)
      .expect(200);
    const urls = res.body.data.flatMap((c: any) => c.photoUrls);
    expect(urls).toContain(RECENT_PHOTO);
    // The 40-day-old check is outside the retention window.
    expect(urls).not.toContain(OLD_PHOTO);
  });

  it('refuses a parent who guards no child on the trip (404)', async () => {
    if (!tokenOtherParent) return;
    await request(app.getHttpServer())
      .get(`/daily-checks/trip/${tripId}/bus-photos`)
      .set('Authorization', `Bearer ${tokenOtherParent}`)
      .expect(404);
  });
});
