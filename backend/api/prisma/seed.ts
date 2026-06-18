import { PrismaClient, Role, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demo seed — three tenants (Yugam School 1/2/3), each with its own admin,
 * driver, parent, route, stops, vehicle, students and a trip scheduled for
 * today. Idempotent: every write is an upsert keyed on a deterministic id, so
 * re-running never duplicates rows.
 *
 * Login (OTP bypass code 123456 when OTP_BYPASS_MODE=true):
 *   School 1 — Admin +919900000001 · Driver +919900000011 · Parent +919900000021
 *   School 2 — Admin +919900000002 · Driver +919900000012 · Parent +919900000022
 *   School 3 — Admin +919900000003 · Driver +919900000013 · Parent +919900000023
 */

interface SchoolSpec {
  idx: number;
  name: string;
  /** Each school's three stops + the school drop point. [name, lat, lng] */
  stops: [string, number, number][];
  schoolCoord: [number, number];
  regNumber: string;
  adminName: string;
  driverName: string;
  parentName: string;
  students: { name: string; regId: string; stopIdx: number }[];
}

const SCHOOLS: SchoolSpec[] = [
  {
    idx: 1,
    name: 'Yugam School 1',
    stops: [
      ['Sector 18 Gate', 28.5678, 77.3234],
      ['DLF Phase 2', 28.4923, 77.0893],
      ['Galleria Market', 28.4665, 77.0805],
    ],
    schoolCoord: [28.4321, 77.0512],
    regNumber: 'HR26-DL-9901',
    adminName: 'Priya Nair',
    driverName: 'Ramesh Kumar',
    parentName: 'Ananya Sharma',
    students: [
      { name: 'Arjun Sharma', regId: 'YS1-2024-001', stopIdx: 0 },
      { name: 'Diya Sharma', regId: 'YS1-2024-002', stopIdx: 1 },
    ],
  },
  {
    idx: 2,
    name: 'Yugam School 2',
    stops: [
      ['MG Road Junction', 12.9756, 77.6068],
      ['Indiranagar Metro', 12.9784, 77.6408],
      ['Koramangala 5th Block', 12.9352, 77.6245],
    ],
    schoolCoord: [12.9279, 77.6271],
    regNumber: 'KA01-MJ-4502',
    adminName: 'Rajesh Menon',
    driverName: 'Suresh Babu',
    parentName: 'Lakshmi Iyer',
    students: [
      { name: 'Karthik Iyer', regId: 'YS2-2024-001', stopIdx: 0 },
      { name: 'Meera Iyer', regId: 'YS2-2024-002', stopIdx: 2 },
    ],
  },
  {
    idx: 3,
    name: 'Yugam School 3',
    stops: [
      ['Bandra Station', 19.0544, 72.8402],
      ['Andheri West', 19.1364, 72.8296],
      ['Powai Lake', 19.1273, 72.9056],
    ],
    schoolCoord: [19.1176, 72.9060],
    regNumber: 'MH02-CD-7803',
    adminName: 'Farah Khan',
    driverName: 'Imran Sheikh',
    parentName: 'Sneha Patil',
    students: [
      { name: 'Aarav Patil', regId: 'YS3-2024-001', stopIdx: 1 },
      { name: 'Isha Patil', regId: 'YS3-2024-002', stopIdx: 2 },
    ],
  },
];

/** Zero-padded phone in the +9199000000XX space, partitioned by role + school. */
function phoneFor(role: 'admin' | 'driver' | 'parent', idx: number): string {
  const base = { admin: 0, driver: 10, parent: 20 }[role];
  return `+9199000000${String(base + idx).padStart(2, '0')}`;
}

async function seedSchool(s: SchoolSpec) {
  const t = `tenant-yugam-${s.idx}`;

  const tenant = await prisma.tenant.upsert({
    where: { id: t },
    update: { name: s.name },
    create: { id: t, name: s.name, timezone: 'Asia/Kolkata' },
  });

  const ageGroup = await prisma.ageGroup.upsert({
    where: { id: `agegroup-${s.idx}` },
    update: {},
    create: {
      id: `agegroup-${s.idx}`,
      tenantId: tenant.id,
      name: 'Primary (Grades 1-5)',
      pickupTime: '07:15',
      dropTime: '14:30',
    },
  });

  // Boarding stops
  const stopIds: string[] = [];
  for (let i = 0; i < s.stops.length; i++) {
    const [name, lat, lng] = s.stops[i];
    const id = `stop-${s.idx}-${i + 1}`;
    await prisma.stop.upsert({
      where: { id },
      update: { name, lat, lng },
      create: { id, tenantId: tenant.id, name, lat, lng },
    });
    stopIds.push(id);
  }

  // School drop point
  const schoolStopId = `stop-${s.idx}-school`;
  await prisma.stop.upsert({
    where: { id: schoolStopId },
    update: { lat: s.schoolCoord[0], lng: s.schoolCoord[1] },
    create: {
      id: schoolStopId,
      tenantId: tenant.id,
      name: s.name,
      lat: s.schoolCoord[0],
      lng: s.schoolCoord[1],
      geofenceRadius: 150,
    },
  });

  // Route + ordered route-stops (boarding stops then the school)
  const routeId = `route-${s.idx}`;
  const route = await prisma.route.upsert({
    where: { id: routeId },
    update: {},
    create: { id: routeId, tenantId: tenant.id, name: `Route A — ${s.name}`, direction: 'PICKUP' },
  });

  const routeStopIds = [...stopIds, schoolStopId];
  for (let i = 0; i < routeStopIds.length; i++) {
    const id = `rs-${s.idx}-${i + 1}`;
    await prisma.routeStop.upsert({
      where: { id },
      update: { sequence: i + 1 },
      create: { id, routeId: route.id, stopId: routeStopIds[i], sequence: i + 1 },
    });
  }

  const vehicle = await prisma.vehicle.upsert({
    where: { tenantId_regNumber: { tenantId: tenant.id, regNumber: s.regNumber } },
    update: {},
    create: { tenantId: tenant.id, regNumber: s.regNumber, capacity: 30 },
  });

  // People — admin / driver / parent
  const admin = await prisma.person.upsert({
    where: { phone: phoneFor('admin', s.idx) },
    update: { name: s.adminName },
    create: { phone: phoneFor('admin', s.idx), name: s.adminName },
  });
  const driver = await prisma.person.upsert({
    where: { phone: phoneFor('driver', s.idx) },
    update: { name: s.driverName },
    create: { phone: phoneFor('driver', s.idx), name: s.driverName },
  });
  const parent = await prisma.person.upsert({
    where: { phone: phoneFor('parent', s.idx) },
    update: { name: s.parentName },
    create: { phone: phoneFor('parent', s.idx), name: s.parentName },
  });

  await prisma.membership.upsert({
    where: { id: `mem-admin-${s.idx}` },
    update: {},
    create: { id: `mem-admin-${s.idx}`, personId: admin.id, tenantId: tenant.id, role: Role.ADMIN, status: MembershipStatus.ACTIVE },
  });
  const driverMembership = await prisma.membership.upsert({
    where: { id: `mem-driver-${s.idx}` },
    update: {},
    create: { id: `mem-driver-${s.idx}`, personId: driver.id, tenantId: tenant.id, role: Role.DRIVER, status: MembershipStatus.ACTIVE },
  });
  await prisma.membership.upsert({
    where: { id: `mem-parent-${s.idx}` },
    update: {},
    create: { id: `mem-parent-${s.idx}`, personId: parent.id, tenantId: tenant.id, role: Role.PARENT, status: MembershipStatus.ACTIVE },
  });

  // Students + guardianship to the parent
  const studentIds: { id: string; stopId: string }[] = [];
  for (let i = 0; i < s.students.length; i++) {
    const st = s.students[i];
    const id = `student-${s.idx}-${i + 1}`;
    const stopId = stopIds[st.stopIdx];
    await prisma.student.upsert({
      where: { id },
      update: {},
      create: {
        id,
        tenantId: tenant.id,
        name: st.name,
        regId: st.regId,
        ageGroupId: ageGroup.id,
        routeId: route.id,
        stopId,
      },
    });
    await prisma.guardianship.upsert({
      where: { id: `guard-${s.idx}-${i + 1}` },
      update: {},
      create: { id: `guard-${s.idx}-${i + 1}`, studentId: id, personId: parent.id, relation: 'Parent', isPrimary: true },
    });
    studentIds.push({ id, stopId });
  }

  await prisma.vehicleAssignment.upsert({
    where: { id: `va-${s.idx}` },
    update: {},
    create: { id: `va-${s.idx}`, vehicleId: vehicle.id, membershipId: driverMembership.id, role: 'DRIVER', effectiveFrom: new Date() },
  });

  // Trip scheduled for today's pickup
  const today = new Date();
  today.setHours(7, 15, 0, 0);
  const tripId = `trip-${s.idx}-today`;
  await prisma.trip.upsert({
    where: { id: tripId },
    update: {},
    create: {
      id: tripId,
      tenantId: tenant.id,
      routeId: route.id,
      vehicleId: vehicle.id,
      date: today,
      direction: 'PICKUP',
      status: 'SCHEDULED',
    },
  });

  for (let i = 0; i < studentIds.length; i++) {
    const { id: studentId, stopId } = studentIds[i];
    await prisma.tripRider.upsert({
      where: { tripId_studentId: { tripId, studentId } },
      update: {},
      create: { id: `tr-${s.idx}-${i + 1}`, tripId, studentId, stopId, boardStatus: 'EXPECTED' },
    });
  }

  console.warn(`  ✅ ${s.name} — admin ${phoneFor('admin', s.idx)}`);
}

async function main() {
  console.warn('🌱 Seeding demo data (Yugam School 1/2/3)...');
  for (const s of SCHOOLS) await seedSchool(s);

  console.warn('');
  console.warn('✅ Seed complete! OTP bypass code: 123456');
  console.warn('');
  console.warn('  School 1  Admin +919900000001 · Driver +919900000011 · Parent +919900000021');
  console.warn('  School 2  Admin +919900000002 · Driver +919900000012 · Parent +919900000022');
  console.warn('  School 3  Admin +919900000003 · Driver +919900000013 · Parent +919900000023');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
