import { PrismaClient, Role, MembershipStatus } from '@prisma/client';

/**
 * Multi-school staging seed (PRD-01 §6, brief Session 1A).
 *
 * Creates N demo schools (tenants), each with its own first ADMIN — a global
 * Person (idempotent on E.164 phone) + an ACTIVE ADMIN Membership scoped to that
 * tenant. This is how we stand up 4–5 tenants to load real sample data and prove
 * tenant isolation: each admin logs in with their own phone (OTP bypass 123456)
 * and must see ONLY their own school.
 *
 * Idempotent: re-running upserts on a fixed tenant id and the admin's phone, so
 * it never duplicates. The existing `demo-tenant-id` seed (scripts/seed.ts) is
 * left untouched — run that separately for the original demo data.
 *
 * Usage:
 *   ts-node scripts/seed-schools.ts                 # 4 schools (default)
 *   SCHOOL_COUNT=5 ts-node scripts/seed-schools.ts  # parameterized count
 *   SCHOOL_NAMES="Greenwood,Oakridge" ts-node scripts/seed-schools.ts
 */

const prisma = new PrismaClient();

const DEFAULT_NAMES = [
  'Greenwood International',
  'Oakridge Public School',
  'Riverside Academy',
  'Sunrise Vidya Mandir',
  'Hilltop Global School',
];

function resolveSchools(): { name: string; index: number }[] {
  const named = process.env.SCHOOL_NAMES?.split(',').map((s) => s.trim()).filter(Boolean);
  if (named && named.length > 0) {
    return named.map((name, index) => ({ name, index }));
  }
  const count = Math.max(1, Number(process.env.SCHOOL_COUNT ?? 4));
  return Array.from({ length: count }, (_, index) => ({
    name: DEFAULT_NAMES[index] ?? `Demo School ${index + 1}`,
    index,
  }));
}

async function main() {
  const schools = resolveSchools();
  console.log(`🌱 Seeding ${schools.length} demo school(s)…\n`);

  const printed: { school: string; adminPhone: string }[] = [];

  for (const { name, index } of schools) {
    // Stable, human-readable tenant id so re-runs upsert instead of duplicate.
    const tenantId = `school-${index + 1}`;
    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name },
      create: { id: tenantId, name, timezone: 'Asia/Kolkata', locale: 'en' },
    });

    // First admin — phone is the login key, deterministic per school so the
    // seed is idempotent (Person is global, keyed by phone).
    const adminPhone = `+9198${String(76000000 + index).padStart(8, '0')}`;
    const admin = await prisma.person.upsert({
      where: { phone: adminPhone },
      update: {},
      create: { phone: adminPhone, name: `${name} Admin` },
    });

    await prisma.membership.upsert({
      where: {
        personId_tenantId_role: { personId: admin.id, tenantId: tenant.id, role: Role.ADMIN },
      },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        personId: admin.id,
        tenantId: tenant.id,
        role: Role.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    console.log(`  ✓ ${name}  (tenant ${tenant.id})  admin ${adminPhone}`);
    printed.push({ school: name, adminPhone });
  }

  console.log('\n✅ Multi-school seed complete. OTP bypass code: 123456');
  console.log('   Admin logins (each scoped to their own school only):');
  for (const p of printed) {
    console.log(`     ${p.adminPhone}  →  ${p.school}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
