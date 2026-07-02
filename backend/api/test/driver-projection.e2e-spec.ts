/**
 * Parent-facing driver projection (e2e) — ITEM 5 (reverses the ITEM 10 curation).
 *
 * FOUNDER DECISION: a parent loading their own child's trip may now VET the driver —
 * name, phone, photo AND licence number, vehicle registration and police-verification
 * status — but aadhaar/address and the full Person row are still never exposed. Seeds
 * one tenant with a route/stop/shift, an ACTIVE student, a vehicle and a driver whose
 * DriverProfile carries KYC (aadhaar, licence, address, police-verification) plus a
 * photoUrl, a PARENT who guards the student, plus a SECOND parent who guards nobody.
 * Schedules a PICKUP trip, authenticates via OTP bypass, and asserts GET /trips/:id:
 *   - driver.name / phone / photoUrl / licenseNumber / policeVerificationStatus / vehicleReg  ✓ present
 *   - driver.aadhaarNumber / address  ✗ absent  (sensitive KYC still stripped)
 *   - the full Person fields (id / email / status / locale) also stripped
 *   - guardian scope: the non-guarding parent gets 404 (can't load the trip at all)
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

// Phone prefix unique to this file → `${PH}10` = +919904100010.
const PH = '+9199041000';
const DRIVER_PHOTO = '/uploads/driver-profiles/driver-a.jpg';

describe('Curated driver projection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tokenAdmin: string;
  let tokenParent: string;
  let tokenOther: string;
  let tripId: string;
  let driverPhone: string;

  const created = {
    tenantIds: [] as string[],
    personIds: [] as string[],
    membershipIds: [] as string[],
    driverProfileIds: [] as string[],
    vehicleIds: [] as string[],
    routeIds: [] as string[],
    stopIds: [] as string[],
    ageGroupIds: [] as string[],
    studentIds: [] as string[],
    guardianshipIds: [] as string[],
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

    const tenant = await prisma.tenant.create({ data: { name: 'DRV Test A' } });
    created.tenantIds.push(tenant.id);

    const pAdmin = await prisma.person.create({ data: { phone: `${PH}10`, name: 'Admin A' } });
    created.personIds.push(pAdmin.id);
    const mAdmin = await prisma.membership.create({
      data: { personId: pAdmin.id, tenantId: tenant.id, role: 'ADMIN', status: 'ACTIVE' },
    });
    created.membershipIds.push(mAdmin.id);

    driverPhone = `${PH}11`;
    const pDriver = await prisma.person.create({
      data: { phone: driverPhone, name: 'Driver A', email: 'driver.a@example.com' },
    });
    created.personIds.push(pDriver.id);
    const mDriver = await prisma.membership.create({
      data: { personId: pDriver.id, tenantId: tenant.id, role: 'DRIVER', status: 'ACTIVE' },
    });
    created.membershipIds.push(mDriver.id);
    // KYC-laden profile — the endpoint must NOT surface any of these fields.
    const driverProfile = await prisma.driverProfile.create({
      data: {
        tenantId: tenant.id,
        membershipId: mDriver.id,
        aadhaarNumber: '1234-5678-9012',
        licenseNumber: 'KA-DL-9988',
        address: '42 Secret Lane, Bengaluru',
        policeVerificationStatus: 'VERIFIED',
        photoUrl: DRIVER_PHOTO,
      },
    });
    created.driverProfileIds.push(driverProfile.id);

    const pParent = await prisma.person.create({ data: { phone: `${PH}12`, name: 'Parent A' } });
    created.personIds.push(pParent.id);
    const mParent = await prisma.membership.create({
      data: { personId: pParent.id, tenantId: tenant.id, role: 'PARENT', status: 'ACTIVE' },
    });
    created.membershipIds.push(mParent.id);

    // A second PARENT in the same tenant who guards NO student — used to prove the
    // trip read is still guardian-scoped (they must not be able to load the trip).
    const pOther = await prisma.person.create({ data: { phone: `${PH}13`, name: 'Parent B' } });
    created.personIds.push(pOther.id);
    const mOther = await prisma.membership.create({
      data: { personId: pOther.id, tenantId: tenant.id, role: 'PARENT', status: 'ACTIVE' },
    });
    created.membershipIds.push(mOther.id);

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: tenant.id, regNumber: 'KA01DRV', capacity: 40, status: 'ACTIVE' },
    });
    created.vehicleIds.push(vehicle.id);

    const route = await prisma.route.create({ data: { tenantId: tenant.id, name: 'Driver Route' } });
    created.routeIds.push(route.id);

    const stop = await prisma.stop.create({
      data: { tenantId: tenant.id, name: 'Driver Stop', lat: 12.9, lng: 77.6 },
    });
    created.stopIds.push(stop.id);
    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });

    const ageGroup = await prisma.ageGroup.create({
      data: { tenantId: tenant.id, name: 'All-day', pickupTime: '07:00', dropTime: '14:00', routeId: route.id },
    });
    created.ageGroupIds.push(ageGroup.id);

    const student = await prisma.student.create({
      data: { tenantId: tenant.id, name: 'Driver Kid', ageGroupId: ageGroup.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' },
    });
    created.studentIds.push(student.id);

    const guardianship = await prisma.guardianship.create({
      data: { studentId: student.id, personId: pParent.id, relation: 'parent', isPrimary: true },
    });
    created.guardianshipIds.push(guardianship.id);

    if (process.env.OTP_BYPASS_CODE === '123456') {
      for (const [phone, set] of [
        [`${PH}10`, (t: string) => (tokenAdmin = t)],
        [`${PH}12`, (t: string) => (tokenParent = t)],
        [`${PH}13`, (t: string) => (tokenOther = t)],
      ] as const) {
        await request(app.getHttpServer()).post('/auth/otp/request').send({ phone });
        const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone, otp: '123456' });
        set(res.body?.data?.accessToken);
      }
    }
    if (process.env.OTP_BYPASS_CODE === '123456' && (!tokenAdmin || !tokenParent || !tokenOther)) {
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
          date: scheduledStartFor(7).toISOString(),
          direction: 'PICKUP',
          scheduledStart: scheduledStartFor(7).toISOString(),
        })
        .expect(201);
      tripId = res.body.data.id;
      created.tripIds.push(tripId);
    }
  });

  afterAll(async () => {
    const swallow = (p: Promise<unknown>) => p.catch(() => undefined);
    await swallow(prisma.tripRider.deleteMany({ where: { tripId: { in: created.tripIds } } }));
    await swallow(prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } }));
    await swallow(prisma.guardianship.deleteMany({ where: { id: { in: created.guardianshipIds } } }));
    await swallow(prisma.student.deleteMany({ where: { id: { in: created.studentIds } } }));
    await swallow(prisma.routeStop.deleteMany({ where: { routeId: { in: created.routeIds } } }));
    await swallow(prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } }));
    await swallow(prisma.ageGroup.deleteMany({ where: { id: { in: created.ageGroupIds } } }));
    await swallow(prisma.route.deleteMany({ where: { id: { in: created.routeIds } } }));
    await swallow(prisma.vehicle.deleteMany({ where: { id: { in: created.vehicleIds } } }));
    await swallow(prisma.driverProfile.deleteMany({ where: { id: { in: created.driverProfileIds } } }));
    await swallow(prisma.membership.deleteMany({ where: { id: { in: created.membershipIds } } }));
    await swallow(prisma.person.deleteMany({ where: { id: { in: created.personIds } } }));
    await swallow(prisma.tenant.deleteMany({ where: { id: { in: created.tenantIds } } }));
    await app.close();
  });

  describe('GET /trips/:id (parent actor)', () => {
    it('exposes the vetting projection { name, phone, photoUrl, licenseNumber, policeVerificationStatus, vehicleReg }', async () => {
      if (!tokenParent) return;
      const res = await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${tokenParent}`)
        .expect(200);

      const driver = res.body.data.driver;
      expect(driver).toBeTruthy();
      expect(driver.name).toBe('Driver A');
      expect(driver.phone).toBe(driverPhone);
      expect(driver.photoUrl).toBe(DRIVER_PHOTO);
      // Item 5 — the parent can now vet the driver.
      expect(driver.licenseNumber).toBe('KA-DL-9988');
      expect(driver.policeVerificationStatus).toBe('VERIFIED');
      expect(driver.vehicleReg).toBe('KA01DRV');

      // Exactly the six projected keys — nothing more.
      expect(Object.keys(driver).sort()).toEqual(
        ['licenseNumber', 'name', 'phone', 'photoUrl', 'policeVerificationStatus', 'vehicleReg'],
      );
    });

    it('still never leaks the sensitive KYC (aadhaar/address) or the full Person row', async () => {
      if (!tokenParent) return;
      const res = await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${tokenParent}`)
        .expect(200);

      const driver = res.body.data.driver;
      // Sensitive KYC — must never appear.
      expect(driver.aadhaarNumber).toBeUndefined();
      expect(driver.address).toBeUndefined();
      // Full Person fields — also stripped.
      expect(driver.id).toBeUndefined();
      expect(driver.email).toBeUndefined();
      expect(driver.status).toBeUndefined();
      expect(driver.locale).toBeUndefined();

      // Defence in depth: the serialized payload contains no aadhaar/address/email.
      const raw = JSON.stringify(res.body.data);
      expect(raw).not.toContain('1234-5678-9012');
      expect(raw).not.toContain('Secret Lane');
      expect(raw).not.toContain('driver.a@example.com');
    });

    it('stays guardian-scoped — a parent who guards no rider on the trip gets 404', async () => {
      if (!tokenOther) return;
      await request(app.getHttpServer())
        .get(`/trips/${tripId}`)
        .set('Authorization', `Bearer ${tokenOther}`)
        .expect(404);
    });
  });
});
