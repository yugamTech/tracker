/**
 * Shifts (AgeGroup CRUD) + shift-aware trip scheduling (e2e).
 *
 * Seeds tenant A (admin, a driver, a vehicle, a route+stop, two shifts and a
 * student in each) plus tenant B (one shift), authenticates as tenant-A admin via
 * OTP bypass, then asserts:
 *   - create / update / delete a shift, tenant-scoped
 *   - a cross-tenant shift id → 404 (never 500, never a silent cross-tenant write)
 *   - delete a shift that still has students → 409
 *   - a shift-aware trip derives scheduledStart from the shift time and filters its
 *     roster to that shift's students
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

// Phone prefix unique to this file → `${PH}10` = +919902000010 (valid IN mobile).
const PH = '+9199020000';

describe('Shifts + shift-aware trips (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAAdmin: string;

  // Tenant A seed ids
  let routeAId: string;
  let vehicleAId: string;
  let driverAPersonId: string;
  let shiftMorningId: string; // 07:30 pickup — has a student
  let shiftAfternoonId: string; // 12:15 pickup — has the other student
  let studentMorningId: string;
  // Tenant B (cross-tenant target)
  let shiftBId: string;
  // Shift created during the CRUD tests (created in POST, mutated in PATCH/DELETE).
  let createdShiftId: string;

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

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    // Mirror main.ts so the suite tests the app as it ships.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    prisma = app.get(PrismaService);

    // ── Tenant A ─────────────────────────────────────────────────────────
    const tenantA = await prisma.tenant.create({ data: { name: 'SHIFT Test A' } });
    created.tenantIds.push(tenantA.id);

    const pAAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAAdmin.id);
    const mAAdmin = await prisma.membership.create({
      data: { personId: pAAdmin.id, tenantId: tenantA.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAAdmin.id);

    const pADriver = await prisma.person.create({ data: { phone: `${PH}11`, name: 'Driver A' } });
    created.personIds.push(pADriver.id);
    driverAPersonId = pADriver.id;
    const mADriver = await prisma.membership.create({
      data: { personId: pADriver.id, tenantId: tenantA.id, role: 'DRIVER', status: 'ACTIVE' },
    });
    created.membershipIds.push(mADriver.id);

    const vehicleA = await prisma.vehicle.create({
      data: { tenantId: tenantA.id, regNumber: 'KA01SHIFT', capacity: 40, status: 'ACTIVE' },
    });
    created.vehicleIds.push(vehicleA.id);
    vehicleAId = vehicleA.id;

    const routeA = await prisma.route.create({
      data: { tenantId: tenantA.id, name: 'Shift Route A', direction: 'PICKUP' },
    });
    created.routeIds.push(routeA.id);
    routeAId = routeA.id;

    const stopA = await prisma.stop.create({
      data: { tenantId: tenantA.id, name: 'Shift Stop A', lat: 12.9, lng: 77.6 },
    });
    created.stopIds.push(stopA.id);
    await prisma.routeStop.create({ data: { routeId: routeA.id, stopId: stopA.id, sequence: 1 } });

    const shiftMorning = await prisma.ageGroup.create({
      data: { tenantId: tenantA.id, name: 'First shift', pickupTime: '07:30', dropTime: '14:30', routeId: routeA.id },
    });
    created.ageGroupIds.push(shiftMorning.id);
    shiftMorningId = shiftMorning.id;

    const shiftAfternoon = await prisma.ageGroup.create({
      data: { tenantId: tenantA.id, name: 'Second shift', pickupTime: '12:15', dropTime: '17:30', routeId: routeA.id },
    });
    created.ageGroupIds.push(shiftAfternoon.id);
    shiftAfternoonId = shiftAfternoon.id;

    const studentMorning = await prisma.student.create({
      data: { tenantId: tenantA.id, name: 'Morning Kid', ageGroupId: shiftMorning.id, routeId: routeA.id, stopId: stopA.id, status: 'ACTIVE' },
    });
    created.studentIds.push(studentMorning.id);
    studentMorningId = studentMorning.id;

    const studentAfternoon = await prisma.student.create({
      data: { tenantId: tenantA.id, name: 'Afternoon Kid', ageGroupId: shiftAfternoon.id, routeId: routeA.id, stopId: stopA.id, status: 'ACTIVE' },
    });
    created.studentIds.push(studentAfternoon.id);

    // ── Tenant B (cross-tenant target) ───────────────────────────────────
    const tenantB = await prisma.tenant.create({ data: { name: 'SHIFT Test B' } });
    created.tenantIds.push(tenantB.id);
    const shiftB = await prisma.ageGroup.create({
      data: { tenantId: tenantB.id, name: 'B shift', pickupTime: '08:00', dropTime: '15:00' },
    });
    created.ageGroupIds.push(shiftB.id);
    shiftBId = shiftB.id;

    // ── Token via OTP bypass ─────────────────────────────────────────────
    if (process.env.OTP_BYPASS_CODE === '123456') {
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}10` });
      const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone: `${PH}10`, otp: '123456' });
      tokenAAdmin = res.body?.data?.accessToken;
    }
    if (process.env.OTP_BYPASS_CODE === '123456' && !tokenAAdmin) {
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
    await swallow(prisma.vehicle.deleteMany({ where: { id: { in: created.vehicleIds } } }));
    await swallow(prisma.membership.deleteMany({ where: { id: { in: created.membershipIds } } }));
    await swallow(prisma.person.deleteMany({ where: { id: { in: created.personIds } } }));
    await swallow(prisma.tenant.deleteMany({ where: { id: { in: created.tenantIds } } }));
    await app.close();
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  describe('POST /age-groups', () => {
    it('returns 401 without a token', () =>
      request(app.getHttpServer()).post('/age-groups').send({ name: 'X', pickupTime: '08:00', dropTime: '14:00' }).expect(401));

    it('creates a shift (201) and lists it', async () => {
      if (!tokenAAdmin) return;
      const res = await request(app.getHttpServer())
        .post('/age-groups')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ name: 'Created shift', pickupTime: '09:15', dropTime: '15:45' })
        .expect(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.pickupTime).toBe('09:15');
      created.ageGroupIds.push(res.body.data.id);
      createdShiftId = res.body.data.id;

      const list = await request(app.getHttpServer())
        .get('/age-groups')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(200);
      expect(list.body.data.some((s: any) => s.id === createdShiftId)).toBe(true);
    });

    it('rejects a malformed HH:MM time (400)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .post('/age-groups')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ name: 'Bad time', pickupTime: '8:00', dropTime: '14:00' })
        .expect(400);
    });
  });

  describe('PATCH /age-groups/:id', () => {
    it('updates a shift in this tenant (200)', async () => {
      if (!tokenAAdmin) return;
      const res = await request(app.getHttpServer())
        .patch(`/age-groups/${createdShiftId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ name: 'Renamed shift', pickupTime: '10:00' })
        .expect(200);
      expect(res.body.data.name).toBe('Renamed shift');
      expect(res.body.data.pickupTime).toBe('10:00');
    });

    it('returns 404 for a cross-tenant shift id (IDOR)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .patch(`/age-groups/${shiftBId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ name: 'hijack' })
        .expect(404);
    });
  });

  describe('DELETE /age-groups/:id', () => {
    it('returns 409 when the shift still has students', async () => {
      if (!tokenAAdmin) return;
      const res = await request(app.getHttpServer())
        .delete(`/age-groups/${shiftMorningId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(409);
      expect(String(res.body.error?.message ?? res.body.message)).toMatch(/Reassign/i);
    });

    it('returns 404 for a cross-tenant shift id (IDOR)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .delete(`/age-groups/${shiftBId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(404);
    });

    it('deletes a shift with no students (200)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .delete(`/age-groups/${createdShiftId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(200);
    });
  });

  // ── Shift-aware trip scheduling ─────────────────────────────────────────────

  describe('POST /trips (shift-aware)', () => {
    it('derives scheduledStart from the shift time and filters riders to that shift', async () => {
      if (!tokenAAdmin) return;
      // A day ~3 days out so the derived 07:30 start is comfortably inside the
      // [now, +1 month] scheduling window regardless of the current time.
      const day = new Date();
      day.setDate(day.getDate() + 3);
      day.setHours(0, 0, 0, 0);

      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({
          routeId: routeAId,
          vehicleId: vehicleAId,
          driverId: driverAPersonId,
          date: day.toISOString(),
          direction: 'PICKUP',
          shiftId: shiftMorningId,
          // No scheduledStart — the shift's pickupTime (07:30) must drive it.
        })
        .expect(201);

      created.tripIds.push(res.body.data.id);
      expect(res.body.data.shiftId).toBe(shiftMorningId);

      // scheduledStart uses the shift's 07:30 pickup (local wall-clock).
      const ss = new Date(res.body.data.scheduledStart);
      expect(ss.getHours()).toBe(7);
      expect(ss.getMinutes()).toBe(30);

      // Roster filtered to the morning shift only — the afternoon student (same
      // route + stop, different shift) must NOT be on it.
      const riders = res.body.data.riders as Array<{ studentId: string }>;
      expect(riders).toHaveLength(1);
      expect(riders[0].studentId).toBe(studentMorningId);
    });

    it('returns 400 for a cross-tenant shift id', async () => {
      if (!tokenAAdmin) return;
      const day = new Date();
      day.setDate(day.getDate() + 3);
      day.setHours(0, 0, 0, 0);
      return request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({
          routeId: routeAId,
          vehicleId: vehicleAId,
          driverId: driverAPersonId,
          date: day.toISOString(),
          direction: 'PICKUP',
          shiftId: shiftBId,
        })
        .expect(400);
    });
  });
});
