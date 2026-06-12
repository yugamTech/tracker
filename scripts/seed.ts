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

  console.log('\n✅ Seed complete.');
  console.log('   OTP bypass code: 123456  (set OTP_BYPASS_CODE=123456 in .env)');
  console.log('   Demo phones: +919999000001 (parent), +919999000002 (driver), +919999000003 (admin)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
