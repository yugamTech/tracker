# Yaanam — Pre-Staging Brief (real-data-ready, minimal features)

> **Read this whole file before coding.** It is the authoritative spec for this
> milestone. PRDs in `/PRDS` win over this brief; this brief wins over assumptions.
> Goal: make the system ready to load REAL data for 4–5 schools and test it, so we
> can catch schema/flow problems early — NOT to add every feature.

This milestone is split into **3 sessions** (run in order). Each session = its own
chat. Commit locally after each step. **Do NOT push — the user pushes manually.**
Keep `npm run verify` green (husky pre-commit enforces it). Build ONLY what's listed;
if you think you need more, STOP and ask.

Project = "Yaanam" (multi-tenant school-bus SaaS). NestJS+Prisma+Postgres+Redis+
Socket.IO backend (`backend/api`); Expo RN apps (parent-app, driver-app, admin-app);
shared packages `@saarthi/*` (KEEP this internal scope — see Session 1C). Git branch
`main`. Foundation + ops layer are built & pushed.

---

## Global guardrails (inherited — all still apply)
- **Tenant isolation (NFR-05):** every query carries `tenant_id`; an admin sees ONLY
  their own school. No cross-tenant read in any path.
- **RBAC:** admin CRUD is `@Roles(ADMIN, TRANSPORT_MANAGER)` behind `RolesGuard`
  (pattern already on members/students/etc.). New write endpoints follow it.
- **Identity:** global Person keyed by E.164 phone; idempotent Person + Membership
  (reuse `phone.util.ts` + the `students.service.create()` pattern). Never duplicate a Person.
- **Soft delete only** (status flags). **Timestamps UTC.** **OTP bypass (123456) untouched.**
- **Notifications fire-and-forget** with `.catch()`; FCM no-ops without config; no real SMS/WhatsApp.
- **DPDP:** driver KYC fields (esp. Aadhaar) are sensitive personal data. For staging,
  store as plain text fields, but add a `// DPDP: encrypt/mask before production` note
  on those columns. No document-image uploads this milestone (no object storage yet).
- Migrations are committed. Keep `npm run verify` green before every commit.

---

# SESSION 1 — Onboarding & multi-school (PRIORITY: do this first)
Model: **Opus, high thinking** (bulk import = data-integrity critical).

## 1A. Multi-school (4–5 tenants), admin scoped to own school
- Add `scripts/seed-schools.ts`: creates N demo schools (tenants), each with its own
  first ADMIN (Person + ACTIVE ADMIN Membership, idempotent on phone). Parameterize the
  count/names; print each school's admin phone (OTP 123456). Keep the existing demo
  tenant working.
- **Verify** every admin-facing list/CRUD is tenant-filtered: log in as School A admin →
  cannot see School B's students/staff/routes/vehicles/trips/complaints. The TenantGuard
  + tenant_id filters already exist — confirm and fix any endpoint that forgets the filter.
- Tenant CREATION via UI (super-admin) is OUT of scope — the seed script covers staging.

## 1B. Bulk Excel import (PRD-01 FR-16–21) — the headline of this milestone
Use a server-side spreadsheet lib (`exceljs` preferred). Add to `backend/api`.
- **Model** `ImportBatch { id, tenantId, entityType, status, createdById, createdCount,
  updatedCount, errorCount, errorReport Json?, createdAt }` + migration.
- **Entity types** (fixed templates): `students` (with guardian + route + stop),
  `staff` (drivers/conductors/admins), `vehicles`, `routes_stops` (routes + their ordered
  stops with lat/lng), `age_groups`.
- **Endpoints** (admin-only, tenant-scoped):
  - `GET  /onboarding/template?type=` → returns the fixed-format template (column list /
    a generated .xlsx) for that entity.
  - `POST /onboarding/validate?type=` (file upload) → **dry-run**: parse, validate, and
    return `{ willCreate, willUpdate, errors:[{row, field, message}] }`. Writes NOTHING.
  - `POST /onboarding/commit?type=` (file upload) → **atomic per batch** (transaction):
    apply creates/updates, record an ImportBatch, return totals + error report.
- **Validation rules:** required fields; phone format (E.164 via phone.util); referential
  existence (a student's route/stop/age-group must already exist in the tenant — so import
  order is routes_stops & age_groups → vehicles & staff → students); duplicate detection.
- **Idempotent:** people on phone, students/vehicles on regId/regNumber. Re-uploading a
  corrected file UPDATES, never duplicates.
- **Students import builds the full linkage** (reuse students.service.create logic):
  Person(guardian) + Guardianship + Student + route/stop assignment — so a child is pinned
  to a stop (this is how per-stop arrival alerts work).
- **UI:** wire the existing `apps/admin-app/app/(app)/people/import/` placeholder screens:
  pick entity type → download template → upload file → see validation preview
  (counts + per-row errors, downloadable) → confirm → result summary. New api-client hooks.
- **Verify:** import a small routes_stops sheet then a students sheet (with route+stop
  columns) → preview shows correct counts/errors → commit creates the links → re-import
  the same file updates (no duplicates) → a scheduled trip on that route auto-builds the
  roster from those students.

## 1C. Rename display strings Saarthi → Yaanam (DISPLAY ONLY)
- Replace the ~24 **user-facing** "Saarthi" strings → "Yaanam": app names/slugs in each
  `app.json`/`app.config`, screen titles, headers, on-screen copy, email/notification copy.
- **DO NOT** rename the internal `@saarthi/*` package scope or import paths (156 sites,
  pure churn users never see — the user will do that later). Grep `Saarthi` (capitalized)
  excluding `@saarthi`, and fix those. Verify the apps still build.

---

# SESSION 2 — Driver KYC & trip-start governance
Model: **Opus, high thinking** (schema change + start-gating logic).

## 2A. Driver details / KYC (text only)
- **Model** `DriverProfile` (1:1 with the driver's Membership or Person; tenant-scoped):
  `aadhaarNumber, address, licenseNumber, licenseExpiry?, policeVerificationStatus
  (PENDING/VERIFIED/REJECTED), policeVerificationRef?, photoUrl?` + migration. Mark Aadhaar
  with the DPDP note. `photoUrl` optional — leave document-image upload OUT (no storage).
- Endpoints: admin can create/edit a driver's profile; the driver can view/edit their own.
  Tenant-scoped, RBAC (admin write any; driver write own).
- UI: admin staff detail → KYC section; driver profile screen → view/edit own KYC.

## 2B. Trip-start governance (daily checks + ±1hr window)
- Add `scheduledStart DateTime` to `Trip`; set it at scheduling time (derive from the
  trip date + the route's age-group pickupTime/dropTime by direction, or admin-entered).
  Migration; backfill existing rows from date if needed.
- **Start rule** (`POST /trips/:id/start`): a trip may start cleanly only if BOTH:
  1. a **DailyCheck** exists for this trip's vehicle today (the foundation DailyCheck model), AND
  2. now is within **[scheduledStart − 1h, scheduledStart + 1h]**.
- If either fails, the driver must supply a **reason note**; with a note the trip starts
  AND a **`TripStartException`** row is created `{ tripId, startedAt, scheduledStart,
  deltaMinutes, dailyCheckDone:boolean, reason, resolvedById?, resolvedAt? }`.
- **Admin alarm panel:** a screen listing open TripStartExceptions (which driver/route/
  trip, why, how far off) with a Resolve action (records resolver + timestamp). Fire a
  fire-and-forget admin notification when an exception is raised.
- Driver UI: if start is blocked, show why (no daily check / outside window) and a
  "Start anyway — add reason" path that requires the note.
- **Verify:** start with no daily check → blocked → note → starts + alarm; start 2h early
  → note → starts + alarm; start within window with daily check done → no note, no alarm.

---

# SESSION 3 — Complaints polish & minimal maps
Model: **Sonnet, medium-high thinking** (mostly mechanical).

## 3A. Complaints — context, resolution-to-parent, filters
- **Context display:** complaint detail (admin) shows the linked trip's route, date,
  direction (derive via the existing `complaint.trip` relation) so the admin sees exactly
  which ride it was about.
- **Resolution by text:** admin records "how it was resolved" as a note on the resolving
  status transition (ComplaintEvent already exists) → parent gets a fire-and-forget
  notification AND sees the resolution text in their complaint timeline.
- **Admin filters:** the complaint queue filters by status, category, route, driver, and
  date range (combinable). Backend query stays tenant-scoped.
- **Verify:** parent files a complaint on a trip → admin queue shows route/date, filters
  narrow correctly → admin resolves with a note → parent sees the resolution.

## 3B. Driver maps intent (navigate stop → stop)
- On the driver active-trip screen, a "Navigate to next stop" action opens the **Google
  Maps app** via `Linking.openURL` with a directions URL to the next stop's lat/lng
  (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`).
  This is an INTENT (leaves the app) — driver only.

## 3C. Mock live map (parent + admin)
- When a driver starts a trip, parent (track screen) and admin (fleet/trip screen) show a
  **mock** moving-bus map — a simple map placeholder with a marker that animates along the
  route's stops using mock/seeded movement. This is a PLACEHOLDER; the real embedded
  Google live map is a later dedicated phase. Keep it simple; do not add react-native-maps
  or a dev build here.
- Add mock route/trip seed data so this is demoable.

---

## Sequencing & definition of done
- Run **Session 1**, then the user loads real sample data and tests; only then Sessions 2 & 3.
- Each session: commit per step, `npm run verify` green, nothing out of scope, end with a
  commit list + the verification results. No push.
- File map: identity backend `backend/api/src/modules/identity/`; onboarding module
  `backend/api/src/modules/onboarding/` (currently an empty stub — implement it here);
  trips `backend/api/src/modules/trips/`; complaints `backend/api/src/modules/complaints/`;
  admin app `apps/admin-app/app/(app)/{people/import,fleet,complaints,trips}/`; driver app
  `apps/driver-app/app/(app)/`; seed `scripts/`.
