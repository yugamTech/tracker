import { PrismaClient, Role, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.warn('🌱 Seeding demo data...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-demo-001' },
    update: {},
    create: {
      id: 'tenant-demo-001',
      name: 'Sunrise International School',
      timezone: 'Asia/Kolkata',
    },
  });

  // Create age group
  const ageGroup = await prisma.ageGroup.upsert({
    where: { id: 'agegroup-001' },
    update: {},
    create: {
      id: 'agegroup-001',
      tenantId: tenant.id,
      name: 'Primary (Grades 1-5)',
      pickupTime: '07:15',
      dropTime: '14:30',
    },
  });

  // Create stops
  const stop1 = await prisma.stop.upsert({
    where: { id: 'stop-001' },
    update: {},
    create: {
      id: 'stop-001',
      tenantId: tenant.id,
      name: 'Sector 18 Gate',
      lat: 28.5678,
      lng: 77.3234,
    },
  });

  const stop2 = await prisma.stop.upsert({
    where: { id: 'stop-002' },
    update: {},
    create: {
      id: 'stop-002',
      tenantId: tenant.id,
      name: 'DLF Phase 2',
      lat: 28.4923,
      lng: 77.0893,
    },
  });

  // Create route
  const route = await prisma.route.upsert({
    where: { id: 'route-001' },
    update: {},
    create: {
      id: 'route-001',
      tenantId: tenant.id,
      name: 'Route A — Sector 18',
      direction: 'PICKUP',
    },
  });

  // Attach stops to route
  await prisma.routeStop.upsert({
    where: { id: 'rs-001' },
    update: {},
    create: { id: 'rs-001', routeId: route.id, stopId: stop1.id, sequence: 1 },
  });
  await prisma.routeStop.upsert({
    where: { id: 'rs-002' },
    update: {},
    create: { id: 'rs-002', routeId: route.id, stopId: stop2.id, sequence: 2 },
  });

  // Create vehicle
  const vehicle = await prisma.vehicle.upsert({
    where: { tenantId_regNumber: { tenantId: tenant.id, regNumber: 'HR26-DL-9900' } },
    update: {},
    create: {
      tenantId: tenant.id,
      regNumber: 'HR26-DL-9900',
      capacity: 30,
    },
  });

  // Create persons
  const parentPerson = await prisma.person.upsert({
    where: { phone: '+919999000001' },
    update: {},
    create: { phone: '+919999000001', name: 'Ananya Sharma' },
  });

  const driverPerson = await prisma.person.upsert({
    where: { phone: '+919999000002' },
    update: {},
    create: { phone: '+919999000002', name: 'Ramesh Kumar' },
  });

  const adminPerson = await prisma.person.upsert({
    where: { phone: '+919999000003' },
    update: {},
    create: { phone: '+919999000003', name: 'Priya Nair' },
  });

  // Create memberships
  await prisma.membership.upsert({
    where: { id: 'mem-parent-001' },
    update: {},
    create: {
      id: 'mem-parent-001',
      personId: parentPerson.id,
      tenantId: tenant.id,
      role: Role.PARENT,
      status: MembershipStatus.ACTIVE,
    },
  });

  const driverMembership = await prisma.membership.upsert({
    where: { id: 'mem-driver-001' },
    update: {},
    create: {
      id: 'mem-driver-001',
      personId: driverPerson.id,
      tenantId: tenant.id,
      role: Role.DRIVER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.membership.upsert({
    where: { id: 'mem-admin-001' },
    update: {},
    create: {
      id: 'mem-admin-001',
      personId: adminPerson.id,
      tenantId: tenant.id,
      role: Role.ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Create student
  const student = await prisma.student.upsert({
    where: { id: 'student-001' },
    update: {},
    create: {
      id: 'student-001',
      tenantId: tenant.id,
      name: 'Arjun Sharma',
      regId: 'SRS-2024-001',
      ageGroupId: ageGroup.id,
      routeId: route.id,
      stopId: stop1.id,
    },
  });

  // Guardianship
  await prisma.guardianship.upsert({
    where: { id: 'guard-001' },
    update: {},
    create: {
      id: 'guard-001',
      studentId: student.id,
      personId: parentPerson.id,
      relation: 'Mother',
      isPrimary: true,
    },
  });

  // Vehicle assignment
  await prisma.vehicleAssignment.upsert({
    where: { id: 'va-001' },
    update: {},
    create: {
      id: 'va-001',
      vehicleId: vehicle.id,
      membershipId: driverMembership.id,
      role: 'DRIVER',
      effectiveFrom: new Date(),
    },
  });

  // Create a sample trip for today
  const today = new Date();
  today.setHours(7, 15, 0, 0);

  await prisma.trip.upsert({
    where: { id: 'trip-today-001' },
    update: {},
    create: {
      id: 'trip-today-001',
      tenantId: tenant.id,
      routeId: route.id,
      vehicleId: vehicle.id,
      date: today,
      direction: 'PICKUP',
      status: 'SCHEDULED',
    },
  });

  console.warn('✅ Seed complete!');
  console.warn('');
  console.warn('Demo Credentials (OTP bypass code: 123456):');
  console.warn('  Parent:  +919999000001');
  console.warn('  Driver:  +919999000002');
  console.warn('  Admin:   +919999000003');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
