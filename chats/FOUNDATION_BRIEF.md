# Saarthi — Foundation Phase Brief (Operations & Assignment)

> **Read this whole file before writing any code.** It is the authoritative spec for
> this phase. When in doubt, the PRDs in `/PRDS` win over this brief, and this brief
> wins over your assumptions. Do not invent scope. Do not skip the guardrails.

---

## 0. What Saarthi is (60-second context)

Multi-tenant SaaS for K-12 **school bus transport**. Four user surfaces:
- **Parent** (`apps/parent-app`, RN/Expo) — track child's bus, alerts, complaints, pay.
- **Driver** (`apps/driver-app`, RN/Expo) — run trips, push GPS, mark attendance, daily checks.
- **Admin** (`apps/admin-app`, RN/Expo) — configure routes/vehicles/people, run ops, resolve complaints.
- **Founder** (web, not built yet — Phase 6).

Stack: **NestJS + Prisma + PostgreSQL + Redis + Socket.IO** backend (`backend/api`);
Expo RN apps; shared packages `@saarthi/types` (runtime enums — builds to `dist/`),
`@saarthi/ui`, `@saarthi/api-client` (React Query hooks), `@saarthi/config`. Monorepo
is **npm workspaces + Turborepo**. Git branch is **`master`**.

**Phases 1–4 are DONE** (mock UI → CRUD+auth → live GPS/attendance → notifications/complaints).
A stabilize pass also just landed: parent↔student linkage fix, unified React types, a
husky pre-commit + GitHub Actions CI gate. This phase is the **operations/assignment
layer** that was missing — the connective tissue that lets an admin actually run a school.

---

## 1. Authoritative sources — READ FIRST (in this order)

1. `/PRDS/PRD-00-Master.md` — platform principles (multi-tenancy, identity, retention, NFRs).
2. `/PRDS/PRD-01-Identity-Onboarding.md` — **the core PRD for this phase** (FR-13, FR-14, FR-15, FR-12).
3. `/PRDS/PRD-02-Tracking-Trips-Attendance.md` — **also core** (FR-01, FR-02, FR-10, FR-17).
4. `chats/ARCHITECTURE_SUMMARY.md` and `chats/IMPLEMENTATION_ROADMAP.md` — current architecture + phase map.
5. Skim PRD-03/04/05/06 for cross-cutting constraints (notifications fan-out, soft delete, tenant scope).

---

## 2. Scope — what to BUILD this phase (P0 only)

Each item cites the PRD requirement it satisfies. Everything here is P0 foundation.

### 2.1 Schema: bind driver + conductor to a Trip  ← THE LINCHPIN
`Trip` currently has only `vehicleId`. PRD-02 **FR-02 (P0)**: a trip binds *route, vehicle,
**driver, conductor (optional)**, ordered stops, roster.* Add to `model Trip`:
```prisma
driverId    String?
conductorId String?
driver      Person?  @relation("TripDriver",    fields: [driverId],    references: [id])
conductor   Person?  @relation("TripConductor",  fields: [conductorId], references: [id])
```
Add the inverse relations on `Person` (named relations, since Person↔Trip now has two).
Nullable so existing rows/seed don't break. Create a Prisma migration (`npm run db:migrate`).
**Everything else depends on this — do it first, then PAUSE for approval (see §5).**

### 2.2 Staff CRUD (driver / conductor / admin)  — PRD-01 FR-13, FR-14, FR-15 (P0)
`members.controller.ts` is **read-only** today. Add:
- `POST /members` — create a staff member: `{ name, phone, role, email? }`. In ONE
  transaction: upsert `Person` (idempotent on E.164 phone), upsert `Membership`
  `(personId, tenantId, role)` with `status: ACTIVE`. **Mirror exactly** the pattern in
  `students.service.ts → create()` (the parent-linkage code) and its phone normalization.
  Allowed roles for this endpoint: `DRIVER`, `CONDUCTOR`, `ADMIN`, `TRANSPORT_MANAGER`.
- `PATCH /members/:id` — edit name/email/role.
- Deactivate = **soft** (`Membership.status = SUSPENDED` or `Person.status = INACTIVE`),
  **NEVER hard delete** (FR-15, audit/DPDP). Add a deactivate action, not a delete.
- Admin app: build the `apps/admin-app/app/(app)/people/staff/` screens — list (it's a
  placeholder today), **Add Staff**, edit/deactivate. Wire via new `@saarthi/api-client` hooks.

### 2.3 Trip scheduling  — PRD-02 FR-01, FR-02 (P0)
There is **no `POST /trips` and no `TripsService.create()`** — build it.
- `POST /trips` (admin): `{ routeId, vehicleId, driverId, conductorId?, date, direction }`.
- In the service `create()`: create the `Trip` (status `SCHEDULED`), then **build the roster** —
  for every `Student` assigned to that route (`student.routeId === routeId`), create a
  `TripRider { tripId, studentId, stopId: student.stopId, boardStatus: EXPECTED }`. This is
  the "roster of riders expected at each stop" (FR-02). Use a transaction.
- Admin app: a **Schedule Trip** screen (pick route → vehicle → driver → conductor? → date →
  direction → preview roster count → create). Reachable from the trips/fleet section.

### 2.4 Driver-scoping  — PRD-01 FR-12, PRD-02 FR-10 (P0)
Today `GET /trips/today` and `GET /trips` filter by **tenant only**, so every driver sees
every bus. Fix: when the caller's active role is `DRIVER`/`CONDUCTOR`, filter to trips where
`driverId === me` (or `conductorId === me`). Admin/transport-manager keep tenant-wide. Use
the JWT identity (`@PersonId()` / `@ActiveMembershipDec()`). Update the driver-app home/today
hook accordingly. **A driver must never see another driver's trip** (this is the same class
of isolation guarantee as NFR-05).

### 2.5 Admin trip monitor / roster + contact  — PRD-02 §4 screens 7–8 (P0)
The roster API exists (`GET /attendance/trip/:tripId/roster`) but **no admin screen uses it**.
Wire the `apps/admin-app/app/(app)/fleet/[tripId].tsx` placeholder into a real **Trip Monitor**:
live roster (per-stop, board status), exceptions (not-boarded), and **contact** — show each
rider's guardian name + phone (tap to call) so admin can reach a parent/teacher "in case of
anything." Read-only; reuse existing hooks where possible.

### 2.6 Daily checks (driver + vehicle)  — PRD-00 §4 driver persona ("upload daily checks")
The `apps/driver-app/app/(app)/vehicle-check.tsx` screen is a **local-only checklist** that
saves nothing. Make it real (lowest priority — do it LAST):
- New Prisma model `DailyCheck { id, tenantId, tripId?, vehicleId, submittedById, items Json,
  note?, createdAt }` (items = the checklist results). Add migration.
- `POST /daily-checks` (driver) + `GET /daily-checks?vehicleId=&date=`.
- Wire the existing driver screen to POST. (Optional nicety: surface the latest check to admin.)
- NOTE: this is persona-level, not a detailed FR. Keep it simple — a checklist + note, persisted.
  Do **not** build photo/video upload here (that's object storage = a later cost phase).

---

## 3. Scope — what is OUT this phase (do NOT build)

- **Driver papers / license / background profile** — NOT in any PRD. Cut. (User confirmed.)
- **Excel bulk import** — PRD-01 FR-16–21 marks it P0, but it's deferred for the demo
  (manual CRUD + seed cover it). Do not build it now. The `people/import` placeholder stays.
- **Conductor photo upload to object storage** — needs DigitalOcean Spaces (cost phase). The
  capture flow can stay stubbed.
- **Teacher-as-rider** modeling (PRD-01 §3.3) — in scope eventually, not blocking; defer.
- **Maps / Google Maps** — the NEXT phase, after this is pushed. Do not start maps here.
- **Payments, real SMS/WhatsApp, founder analytics** — later phases.
- **Route stop reorder UI** — nice-to-have; only fix the mislabeled "+ Add Vehicle" button on
  the routes list screen (it should say "+ Add Route") if trivial; otherwise leave it.

If you think something outside this list is needed, STOP and ask — do not expand scope silently.

---

## 4. Non-negotiable guardrails (inherited from PRD-00 §5 + prior phases)

1. **Tenant isolation (NFR-05):** every DB query carries `tenant_id`; never trust a client-
   supplied tenant. Cross-tenant read = critical bug. Driver-scoping (§2.4) is the same class.
2. **Identity is global, keyed by E.164 phone.** Reuse the phone normalization in
   `students.service.ts` (`+91XXXXXXXXXX`). Person is idempotent on phone; Membership is
   idempotent on `(personId, tenantId, role)`. NEVER create duplicate Persons.
3. **Soft delete only** — `status = INACTIVE/SUSPENDED`. No hard deletes anywhere (FR-15).
4. **Timestamps UTC** in DB; render in tenant TZ on the client.
5. **Money in paise** (not relevant this phase, but never use floats for money).
6. **OTP bypass stays:** `OTP_BYPASS_MODE=true`, code `123456` must keep working. Do not touch auth.
7. **Notifications are fire-and-forget** with `.catch()` — never `await` a dispatch in a request
   path, never crash a write because a notification failed. (See the existing `.catch()` calls
   in `trips.service.ts` / `attendance.service.ts`.) No real SMS/WhatsApp — FCM no-ops without config.
8. **Migrations are committed** (they're the schema history). Run `npm run db:migrate` for any
   schema change; commit the generated SQL.
9. **The quality gate must stay green.** `npm run verify` (builds `@saarthi/types`, generates
   Prisma client, type-checks all workspaces) must pass before every commit — the husky
   pre-commit runs the type-check and will block you otherwise. Do not use `--no-verify` to
   sneak past failures; fix them.

---

## 5. Build order & process

Work step by step. **Commit locally after each step** with a clear message. Do **not** push to
GitHub — the user pushes manually after reviewing the whole phase.

1. **Schema migration** (§2.1) — add `driverId`/`conductorId` to `Trip`, migrate, regenerate
   client, confirm `npm run verify` green. → **PAUSE and report to the user for approval before
   continuing.** (Schema changes are the highest-blast-radius step.)
2. **Staff CRUD backend** (§2.2 backend) — endpoints + service + api-client hooks. Commit.
3. **Staff CRUD admin UI** (§2.2 frontend) — list/add/edit/deactivate. Commit.
4. **Trip scheduling backend** (§2.3 backend) — `POST /trips` + roster build. Commit.
5. **Trip scheduling admin UI** (§2.3 frontend) — Schedule Trip screen. Commit.
6. **Driver-scoping** (§2.4) — backend filter + driver-app hook. Commit.
7. **Admin trip monitor / roster + contact** (§2.5). Commit.
8. **Daily checks** (§2.6) — model + endpoints + wire driver screen. Commit.
9. Final: run `npm run verify` + `npm run build --workspace=backend/api`; summarize all commits
   and the manual test steps. Hand back to the user to review and push.

After each backend step, sanity-check the endpoint compiles and is registered. After each UI
step, confirm the screen type-checks and uses real hooks (no mock data).

---

## 6. Patterns to mirror (don't reinvent)

- **Idempotent Person + Membership in a transaction:** copy `backend/api/src/modules/identity/
  students.service.ts → create()` (the parent-linkage block) and its `normalizeIndianPhone`.
- **Controllers:** `@UseGuards(JwtAuthGuard)`, `@TenantId()`, `@PersonId()`,
  `@ActiveMembershipDec()` decorators; `class-validator` DTOs. See `students.controller.ts`,
  `trips.controller.ts`.
- **api-client:** add `*.api.ts` (axios calls) + `*.hooks.ts` (React Query) under
  `packages/api-client/src/<domain>/`, export from `src/index.ts`. See `identity/`.
- **Trip lifecycle / fan-out:** `trips.service.ts` `transition()` + `gateway.emitTripStatus()`.
- **Soft-status fields** already exist on `Person` (`PersonStatus`), `Membership`
  (`MembershipStatus`), `Student`, `Vehicle`, `Route`.

## 7. Key file map

- Schema: `backend/api/prisma/schema.prisma` (models Trip, Person, Membership, Student,
  TripRider, Route, Vehicle; enums Role, RiderStatus, TripStatus).
- Identity backend: `backend/api/src/modules/identity/` (controllers/, students.service.ts,
  members.service.ts, vehicles.service.ts, routes.service.ts).
- Trips backend: `backend/api/src/modules/trips/`.
- Attendance/roster: `backend/api/src/modules/attendance/`.
- api-client: `packages/api-client/src/{identity,routes,trips,...}/`.
- Admin app: `apps/admin-app/app/(app)/{people,fleet,routes,trips,complaints}/`.
- Driver app: `apps/driver-app/app/(app)/`.
- Seed: `scripts/seed.ts` (demo phones: parent +919999000001, driver +919999000002,
  admin +919999000003; OTP 123456).

## 8. Definition of done

- All §2 items built and type-checking; `npm run verify` and backend build green.
- A driver sees ONLY their assigned trips; admin can create a driver, schedule a trip with
  that driver+vehicle+route, and the roster auto-populates.
- Admin trip monitor shows roster + guardian contact.
- Nothing in §3 was built. No push to GitHub. All guardrails (§4) held.
- Each step committed locally with a clear message; final summary lists commits + manual test steps.

## 9. Model / effort

Run this phase on **Opus with high thinking** — it's the foundation, correctness matters more
than cost here, and the schema change (§2.1) + driver-scoping isolation (§2.4) deserve the extra
care. (Sonnet would also suffice for the mechanical CRUD, but Opus is preferred for this one.)
If the context window gets tight, use `/compact`; this brief + the PRDs are the durable source
of truth to re-anchor on — re-read them after any compaction.
