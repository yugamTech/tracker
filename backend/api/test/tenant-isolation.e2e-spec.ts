/**
 * Tenant-isolation regression suite (security fixes 6f4454b / a2f98db).
 *
 * Seeds two isolated tenants (A and B), authenticates as various roles in
 * tenant A, then asserts every guarded endpoint returns 404 (cross-tenant
 * IDOR) or 403 (wrong role) when targeting B's resources — never leaking data.
 *
 * Requires OTP_BYPASS_MODE=true + OTP_BYPASS_CODE=123456 in the environment
 * (set automatically in CI via the test-backend job env block).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Phone prefix unique to this file. Must yield a VALID 10-digit Indian mobile
// (the verify DTO enforces @IsPhoneNumber('IN')): `${PH}10` → +919901000010.
const PH = '+9199010000';

describe('Tenant isolation regression (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tenant A identity tokens
  let tokenAAdmin: string;   // ADMIN role in tenant A
  let tokenAParent: string;  // PARENT role in tenant A

  // IDs of resources belonging to tenant B (the "wrong" tenant)
  let tripBId: string;
  let complaintBId: string;
  let invoiceBId: string;
  let studentBId: string;

  // For the refresh-after-deactivation regression (fix a2f98db)
  let personCRefreshToken: string;
  let membershipCId: string;

  // Collected IDs for teardown
  const created = {
    tenantIds: [] as string[],
    personIds: [] as string[],
    membershipIds: [] as string[],
    complaintIds: [] as string[],
    tripRiderIds: [] as string[],
    tripIds: [] as string[],
    studentIds: [] as string[],
    stopIds: [] as string[],
    ageGroupIds: [] as string[],
    feePlanIds: [] as string[],
    invoiceIds: [] as string[],
    routeIds: [] as string[],
  };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    // Mirror main.ts so the suite tests the app as it actually ships: the same
    // ValidationPipe, the global exception filter, and the ResponseInterceptor that
    // wraps every payload in { data, meta } (without it, body.data.* is undefined and
    // token extraction silently fails). Global prefix is omitted — requests use
    // un-prefixed paths and it has no bearing on tenant/role isolation.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);

    // ── Tenant A: admin + parent memberships ─────────────────────────────
    const tenantA = await prisma.tenant.create({ data: { name: 'ISO Test A' } });
    created.tenantIds.push(tenantA.id);

    const pAAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAAdmin.id);
    const mAAdmin = await prisma.membership.create({
      data: { personId: pAAdmin.id, tenantId: tenantA.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAAdmin.id);

    const pAParent = await prisma.person.create({ data: { phone: `${PH}11`, name: 'Parent A' } });
    created.personIds.push(pAParent.id);
    const mAParent = await prisma.membership.create({
      data: { personId: pAParent.id, tenantId: tenantA.id, role: 'PARENT', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAParent.id);

    // Person C: separate person for the refresh-deactivation test
    const pC = await prisma.person.create({ data: { phone: `${PH}12`, name: 'Person C' } });
    created.personIds.push(pC.id);
    const mC = await prisma.membership.create({
      data: { personId: pC.id, tenantId: tenantA.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mC.id);
    membershipCId = mC.id;

    // ── Tenant B: resources that tenant A's tokens must not reach ─────────
    const tenantB = await prisma.tenant.create({ data: { name: 'ISO Test B' } });
    created.tenantIds.push(tenantB.id);

    const pB = await prisma.person.create({ data: { phone: `${PH}20`, name: 'Admin B' } });
    created.personIds.push(pB.id);
    const mB = await prisma.membership.create({
      data: { personId: pB.id, tenantId: tenantB.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mB.id);

    // Complaint owned by tenant B
    const cB = await prisma.complaint.create({
      data: { tenantId: tenantB.id, raisedBy: pB.id, category: 'OTHER', status: 'RECEIVED' },
    });
    created.complaintIds.push(cB.id);
    complaintBId = cB.id;

    // Route + Trip owned by tenant B
    const routeB = await prisma.route.create({
      data: { tenantId: tenantB.id, name: 'Route B', direction: 'PICKUP' },
    });
    created.routeIds.push(routeB.id);
    const tripB = await prisma.trip.create({
      data: { tenantId: tenantB.id, routeId: routeB.id, date: new Date(), direction: 'PICKUP', status: 'SCHEDULED' },
    });
    created.tripIds.push(tripB.id);
    tripBId = tripB.id;

    // AgeGroup + Student + Stop + TripRider owned by tenant B (attendance isolation)
    const agB = await prisma.ageGroup.create({
      data: { tenantId: tenantB.id, name: 'AG-B', pickupTime: '08:00', dropTime: '15:00' },
    });
    created.ageGroupIds.push(agB.id);
    const sB = await prisma.student.create({
      data: { tenantId: tenantB.id, name: 'Student B', ageGroupId: agB.id },
    });
    created.studentIds.push(sB.id);
    studentBId = sB.id;
    const stopB = await prisma.stop.create({
      data: { tenantId: tenantB.id, name: 'Stop B', lat: 28.6, lng: 77.2 },
    });
    created.stopIds.push(stopB.id);
    const riderB = await prisma.tripRider.create({
      data: { tripId: tripBId, studentId: studentBId, stopId: stopB.id },
    });
    created.tripRiderIds.push(riderB.id);

    // FeePlan + Invoice owned by tenant B
    const fpB = await prisma.feePlan.create({
      data: {
        tenantId: tenantB.id,
        name: 'Plan B',
        amountPaise: 100_000,
        effectiveFrom: new Date(),
      },
    });
    created.feePlanIds.push(fpB.id);
    const invB = await prisma.invoice.create({
      data: {
        tenantId: tenantB.id,
        invoiceNo: `ISO-INV-${Date.now()}`,
        studentId: studentBId,
        feePlanId: fpB.id,
        amountPaise: 100_000,
        dueDate: new Date(),
      },
    });
    created.invoiceIds.push(invB.id);
    invoiceBId = invB.id;

    // ── Obtain tokens via OTP bypass (CI: OTP_BYPASS_CODE=123456) ─────────
    if (process.env.OTP_BYPASS_CODE === '123456') {
      // Admin A
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}10` });
      const adminRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: `${PH}10`, otp: '123456' });
      tokenAAdmin = adminRes.body?.data?.accessToken;

      // Parent A
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}11` });
      const parentRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: `${PH}11`, otp: '123456' });
      tokenAParent = parentRes.body?.data?.accessToken;

      // Person C (refresh test)
      await request(app.getHttpServer()).post('/auth/otp/request').send({ phone: `${PH}12` });
      const cRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: `${PH}12`, otp: '123456' });
      personCRefreshToken = cRes.body?.data?.refreshToken;
    }

    // Fail loudly when the bypass IS enabled (i.e. CI) but tokens still weren't
    // obtained — a renamed auth route or a broken seed would otherwise leave every
    // guarded test below to skip to a false green, the exact silent-pass this suite
    // exists to prevent. Locally without bypass, this stays quiet and tests skip.
    if (
      process.env.OTP_BYPASS_CODE === '123456' &&
      (!tokenAAdmin || !tokenAParent || !personCRefreshToken)
    ) {
      throw new Error(
        'e2e setup: OTP bypass is enabled but auth tokens could not be obtained — ' +
          'tests would vacuously skip. Check /auth/otp/verify and the seed data.',
      );
    }
  });

  afterAll(async () => {
    // Delete in FK-dependency order (children before parents).
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
    await swallow(prisma.invoice.deleteMany({ where: { id: { in: created.invoiceIds } } }));
    await swallow(prisma.feePlan.deleteMany({ where: { id: { in: created.feePlanIds } } }));
    await swallow(prisma.tripRider.deleteMany({ where: { id: { in: created.tripRiderIds } } }));
    await swallow(prisma.complaint.deleteMany({ where: { id: { in: created.complaintIds } } }));
    await swallow(prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } }));
    await swallow(prisma.student.deleteMany({ where: { id: { in: created.studentIds } } }));
    await swallow(prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } }));
    await swallow(prisma.ageGroup.deleteMany({ where: { id: { in: created.ageGroupIds } } }));
    await swallow(prisma.route.deleteMany({ where: { id: { in: created.routeIds } } }));
    await swallow(prisma.membership.deleteMany({ where: { id: { in: created.membershipIds } } }));
    await swallow(prisma.person.deleteMany({ where: { id: { in: created.personIds } } }));
    await swallow(prisma.tenant.deleteMany({ where: { id: { in: created.tenantIds } } }));
    await app.close();
  });

  // ── Payments: cross-tenant invoice read ──────────────────────────────────

  describe('GET /payments/invoices/:id', () => {
    it('returns 401 without a token', () =>
      request(app.getHttpServer()).get(`/payments/invoices/${invoiceBId}`).expect(401));

    it('returns 404 when tenant-A admin reads tenant-B invoice (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .get(`/payments/invoices/${invoiceBId}`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(404);
    });
  });

  // ── Complaints: cross-tenant status update ───────────────────────────────

  describe('PATCH /complaints/:id/status', () => {
    it('returns 404 when tenant-A admin updates tenant-B complaint (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .patch(`/complaints/${complaintBId}/status`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(404);
    });
  });

  // ── Trips: cross-tenant start / PARENT role block ────────────────────────

  describe('POST /trips/:id/start', () => {
    it('returns 404 when tenant-A admin starts tenant-B trip (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .post(`/trips/${tripBId}/start`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({})
        .expect(404);
    });

    it('returns 403 for PARENT role regardless of trip tenant (IDOR fix 6f4454b)', async () => {
      if (!tokenAParent) return;
      return request(app.getHttpServer())
        .post(`/trips/${tripBId}/start`)
        .set('Authorization', `Bearer ${tokenAParent}`)
        .send({})
        .expect(403);
    });
  });

  // ── Trips: cross-tenant complete / PARENT role block ─────────────────────

  describe('POST /trips/:id/complete', () => {
    it('returns 404 when tenant-A admin completes tenant-B trip (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .post(`/trips/${tripBId}/complete`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({})
        .expect(404);
    });

    it('returns 403 for PARENT role regardless of trip tenant (IDOR fix 6f4454b)', async () => {
      if (!tokenAParent) return;
      return request(app.getHttpServer())
        .post(`/trips/${tripBId}/complete`)
        .set('Authorization', `Bearer ${tokenAParent}`)
        .send({})
        .expect(403);
    });
  });

  // ── Tracking: cross-tenant GPS reads ─────────────────────────────────────

  describe('GET /tracking/:tripId/latest', () => {
    it('returns 404 when tenant-A token reads tenant-B trip location (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .get(`/tracking/${tripBId}/latest`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(404);
    });
  });

  describe('GET /tracking/trips/:tripId/history', () => {
    it('returns 404 when tenant-A token reads tenant-B trip history (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .get(`/tracking/trips/${tripBId}/history`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(404);
    });
  });

  describe('GET /tracking/trips/:tripId/replay', () => {
    it('returns 404 when tenant-A token reads tenant-B trip replay (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .get(`/tracking/trips/${tripBId}/replay`)
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .expect(404);
    });
  });

  // ── Attendance: cross-tenant mark + PARENT roster block ──────────────────

  describe('POST /attendance', () => {
    it('returns 404 when tenant-A admin marks attendance for tenant-B rider (IDOR fix 6f4454b)', async () => {
      if (!tokenAAdmin) return;
      return request(app.getHttpServer())
        .post('/attendance')
        .set('Authorization', `Bearer ${tokenAAdmin}`)
        .send({ tripId: tripBId, studentId: studentBId, type: 'BOARDED' })
        .expect(404);
    });
  });

  describe('GET /attendance/trip/:tripId/roster', () => {
    it('returns 403 for PARENT role — guardians must not see full roster (IDOR fix 6f4454b)', async () => {
      if (!tokenAParent) return;
      return request(app.getHttpServer())
        .get(`/attendance/trip/${tripBId}/roster`)
        .set('Authorization', `Bearer ${tokenAParent}`)
        .expect(403);
    });
  });

  // ── Auth: refresh token after membership deactivation (fix a2f98db) ───────

  describe('POST /auth/refresh', () => {
    it('returns 401 when membership is SUSPENDED after token was issued (fix a2f98db)', async () => {
      if (!personCRefreshToken || !membershipCId) return;

      await prisma.membership.update({
        where: { id: membershipCId },
        data: { status: 'SUSPENDED' },
      });

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: personCRefreshToken })
        .expect(401);
    });
  });
});
