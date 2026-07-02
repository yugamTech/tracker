/**
 * cancel-pickup authorization (e2e) — IDOR regression for S1.
 *
 * POST /trips/:id/cancel-pickup used to take a bare tripId+studentId and skip any
 * child's pickup — cross-family AND cross-tenant. This locks the fix:
 *   - a PARENT who does NOT guard the child           → 404 (cross-family)
 *   - an ADMIN of a DIFFERENT tenant                  → 404 (cross-tenant)
 *   - a DRIVER (wrong role)                            → 403
 *   - the child's actual guardian (PARENT)            → 201 (still works)
 *
 * Two tenants are seeded. Tenant A has a route/stop/shift, an ACTIVE student who is
 * an EXPECTED rider on a scheduled PICKUP trip, the trip's admin+driver, the child's
 * guardian, and an unrelated "stranger" parent. Tenant B has its own admin.
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

// Phone prefix unique to this file → `${PH}20` = +919905000020.
const PH = '+9199050000';

describe('cancel-pickup authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAdminA: string;
  let tokenAdminB: string;
  let tokenGuardian: string;
  let tokenStranger: string;
  let tokenDriverA: string;
  let studentId: string;
  let pickupTripId: string;

  const created = {
    tenantIds: [] as string[],
    personIds: [] as string[],
    membershipIds: [] as string[],
    guardianshipIds: [] as string[],
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

  const tokenFor = async (phone: string) => {
    await request(app.getHttpServer()).post('/auth/otp/request').send({ phone });
    const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone, otp: '123456' });
    return res.body?.data?.accessToken as string | undefined;
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);

    // --- Tenant A ---
    const tenantA = await prisma.tenant.create({ data: { name: 'AUTHZ Test A' } });
    created.tenantIds.push(tenantA.id);

    const mkMember = async (suffix: string, name: string, role: string, tenantId: string) => {
      const person = await prisma.person.create({ data: { phone: `${PH}${suffix}`, name } });
      created.personIds.push(person.id);
      const membership = await prisma.membership.create({
        data: { personId: person.id, tenantId, role: role as never, status: 'ACTIVE' },
      });
      created.membershipIds.push(membership.id);
      return person;
    };

    const pAdminA = await mkMember('20', 'Admin A', 'ADMIN', tenantA.id);
    const pDriverA = await mkMember('21', 'Driver A', 'DRIVER', tenantA.id);
    const pGuardian = await mkMember('22', 'Guardian A', 'PARENT', tenantA.id);
    const pStranger = await mkMember('23', 'Stranger A', 'PARENT', tenantA.id);

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: tenantA.id, regNumber: 'KA01AUTHZ', capacity: 40, status: 'ACTIVE' },
    });
    created.vehicleIds.push(vehicle.id);

    const route = await prisma.route.create({ data: { tenantId: tenantA.id, name: 'Authz Route' } });
    created.routeIds.push(route.id);

    const stop = await prisma.stop.create({
      data: { tenantId: tenantA.id, name: 'Authz Stop', lat: 12.9, lng: 77.6 },
    });
    created.stopIds.push(stop.id);
    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });

    const ageGroup = await prisma.ageGroup.create({
      data: { tenantId: tenantA.id, name: 'All-day', pickupTime: '07:00', dropTime: '14:00', routeId: route.id },
    });
    created.ageGroupIds.push(ageGroup.id);

    const student = await prisma.student.create({
      data: { tenantId: tenantA.id, name: 'Authz Kid', ageGroupId: ageGroup.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student.id);
    studentId = student.id;

    // Only the guardian is linked to the child.
    const guardianship = await prisma.guardianship.create({
      data: { studentId: student.id, personId: pGuardian.id, relation: 'FATHER', isPrimary: true },
    });
    created.guardianshipIds.push(guardianship.id);

    // --- Tenant B (an unrelated school) ---
    const tenantB = await prisma.tenant.create({ data: { name: 'AUTHZ Test B' } });
    created.tenantIds.push(tenantB.id);
    await mkMember('24', 'Admin B', 'ADMIN', tenantB.id);

    tokenAdminA = (await tokenFor(`${PH}20`)) as string;
    tokenDriverA = (await tokenFor(`${PH}21`)) as string;
    tokenGuardian = (await tokenFor(`${PH}22`)) as string;
    tokenStranger = (await tokenFor(`${PH}23`)) as string;
    tokenAdminB = (await tokenFor(`${PH}24`)) as string;

    if (process.env.OTP_BYPASS_CODE === '123456' && !tokenAdminA) {
      throw new Error('e2e setup: OTP bypass enabled but admin token not obtained — tests would vacuously skip.');
    }

    if (tokenAdminA) {
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          routeId: route.id,
          vehicleId: vehicle.id,
          driverId: pDriverA.id,
          date: scheduledStartFor(7).toISOString(),
          direction: 'PICKUP',
          scheduledStart: scheduledStartFor(7).toISOString(),
        })
        .expect(201);
      pickupTripId = res.body.data.id;
      created.tripIds.push(pickupTripId);
    }
  });

  afterAll(async () => {
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
    await swallow(prisma.pickupCancellation.deleteMany({ where: { tripId: { in: created.tripIds } } }));
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

  describe('POST /trips/:id/cancel-pickup — authorization', () => {
    it('rejects a parent who does not guard the child (404, cross-family)', async () => {
      if (!tokenStranger) return;
      await request(app.getHttpServer())
        .post(`/trips/${pickupTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenStranger}`)
        .send({ studentId })
        .expect(404);
    });

    it('rejects an admin from another tenant (404, cross-tenant)', async () => {
      if (!tokenAdminB) return;
      await request(app.getHttpServer())
        .post(`/trips/${pickupTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ studentId })
        .expect(404);
    });

    it('rejects a driver (403, wrong role)', async () => {
      if (!tokenDriverA) return;
      await request(app.getHttpServer())
        .post(`/trips/${pickupTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenDriverA}`)
        .send({ studentId })
        .expect(403);
    });

    it("allows the child's own guardian (201)", async () => {
      if (!tokenGuardian) return;
      const res = await request(app.getHttpServer())
        .post(`/trips/${pickupTripId}/cancel-pickup`)
        .set('Authorization', `Bearer ${tokenGuardian}`)
        .send({ studentId })
        .expect(201);
      expect(res.body.data.cutoff?.canCancel).toBe(true);
    });
  });
});
