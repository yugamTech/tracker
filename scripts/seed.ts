import { PrismaClient, Role, MembershipStatus, TripStatus, Direction } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo tenant and test users...');

  // ── Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-id' },
    update: {},
    create: {
      id: 'demo-tenant-id',
      name: 'Saarthi Demo School',
      timezone: 'Asia/Kolkata',
      locale: 'en',
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name}`);

  // ── Persons ──────────────────────────────────────────────────────────────
  const parent = await prisma.person.upsert({
    where: { phone: '+919999000001' },
    update: {},
    create: { phone: '+919999000001', name: 'Demo Parent' },
  });

  const driver = await prisma.person.upsert({
    where: { phone: '+919999000002' },
    update: {},
    create: { phone: '+919999000002', name: 'Demo Driver' },
  });

  const admin = await prisma.person.upsert({
    where: { phone: '+919999000003' },
    update: {},
    create: { phone: '+919999000003', name: 'Demo Admin' },
  });
  console.log('  ✓ Persons: parent, driver, admin');

  // ── Memberships ──────────────────────────────────────────────────────────
  await prisma.membership.upsert({
    where: { personId_tenantId_role: { personId: parent.id, tenantId: tenant.id, role: Role.PARENT } },
    update: {},
    create: { personId: parent.id, tenantId: tenant.id, role: Role.PARENT, status: MembershipStatus.ACTIVE },
  });

  await prisma.membership.upsert({
    where: { personId_tenantId_role: { personId: driver.id, tenantId: tenant.id, role: Role.DRIVER } },
    update: {},
    create: { personId: driver.id, tenantId: tenant.id, role: Role.DRIVER, status: MembershipStatus.ACTIVE },
  });

  await prisma.membership.upsert({
    where: { personId_tenantId_role: { personId: admin.id, tenantId: tenant.id, role: Role.ADMIN } },
    update: {},
    create: { personId: admin.id, tenantId: tenant.id, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
  });
  console.log('  ✓ Memberships: PARENT, DRIVER, ADMIN');

  // ── Age Group ────────────────────────────────────────────────────────────
  const ageGroup = await prisma.ageGroup.upsert({
    where: { id: 'demo-agegroup-id' },
    update: {},
    create: {
      id: 'demo-agegroup-id',
      tenantId: tenant.id,
      name: 'Class 1-5',
      pickupTime: '07:30',
      dropTime: '13:30',
    },
  });

  // ── Student ──────────────────────────────────────────────────────────────
  const student = await prisma.student.upsert({
    where: { tenantId_regId: { tenantId: tenant.id, regId: 'STU001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Demo Student',
      regId: 'STU001',
      ageGroupId: ageGroup.id,
    },
  });

  await prisma.guardianship.upsert({
    where: { studentId_personId: { studentId: student.id, personId: parent.id } },
    update: {},
    create: { studentId: student.id, personId: parent.id, relation: 'PARENT', isPrimary: true },
  });
  console.log('  ✓ Student + guardianship');

  // ── Mock route, stops, vehicle, and active trip (3C map demo) ────────────
  const stopDefs = [
    { id: 'demo-stop-1', name: 'Gate 1 – School', lat: 12.9352, lng: 77.6245 },
    { id: 'demo-stop-2', name: 'Park View Colony', lat: 12.9318, lng: 77.6198 },
    { id: 'demo-stop-3', name: 'Bannerghatta Junction', lat: 12.9271, lng: 77.6150 },
    { id: 'demo-stop-4', name: 'Rainbow Nagar', lat: 12.9220, lng: 77.6085 },
  ];

  for (const s of stopDefs) {
    await prisma.stop.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, tenantId: tenant.id, name: s.name, lat: s.lat, lng: s.lng },
    });
  }

  const mockRoute = await prisma.route.upsert({
    where: { id: 'demo-route-id' },
    update: {},
    create: { id: 'demo-route-id', tenantId: tenant.id, name: 'Demo Morning Route', direction: Direction.PICKUP },
  });

  for (let i = 0; i < stopDefs.length; i++) {
    const existingRS = await prisma.routeStop.findFirst({
      where: { routeId: mockRoute.id, stopId: stopDefs[i].id },
    });
    if (!existingRS) {
      await prisma.routeStop.create({
        data: { routeId: mockRoute.id, stopId: stopDefs[i].id, sequence: i + 1 },
      });
    }
  }

  const vehicle = await prisma.vehicle.upsert({
    where: { tenantId_regNumber: { tenantId: tenant.id, regNumber: 'KA-01-AB-1234' } },
    update: {},
    create: { tenantId: tenant.id, regNumber: 'KA-01-AB-1234', type: 'BUS', capacity: 40 },
  });

  const now = new Date();
  const tripDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mockTrip = await prisma.trip.upsert({
    where: { id: 'demo-trip-id' },
    update: {},
    create: {
      id: 'demo-trip-id',
      tenantId: tenant.id,
      routeId: mockRoute.id,
      vehicleId: vehicle.id,
      driverId: driver.id,
      date: tripDate,
      direction: Direction.PICKUP,
      scheduledStart: new Date(tripDate.getTime() + 7 * 3600000 + 30 * 60000),
      status: TripStatus.STARTED,
      startedAt: new Date(now.getTime() - 10 * 60000),
    },
  });

  await prisma.tripRider.upsert({
    where: { tripId_studentId: { tripId: mockTrip.id, studentId: student.id } },
    update: {},
    create: { tripId: mockTrip.id, studentId: student.id, stopId: stopDefs[1].id },
  });
  console.log('  ✓ Mock route + stops + vehicle + active trip (3C map demo)');

  console.log('\n✅ Seed complete.');
  console.log('   OTP bypass code: 123456  (set OTP_BYPASS_CODE=123456 in .env)');
  console.log('   Demo phones: +919999000001 (parent), +919999000002 (driver), +919999000003 (admin)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
