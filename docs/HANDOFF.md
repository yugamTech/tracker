# Yaanam — Engineering Handoff (context for a fresh chat)

Point a new chat at this file: *"Read docs/HANDOFF.md, then continue."*

Yaanam = multi-tenant school-bus tracking. Monorepo (npm workspaces): `backend/api`
(NestJS + Prisma + Postgres + Redis + Socket.IO), Expo/RN apps `apps/{admin,parent,driver}-app`,
shared `packages/{types,api-client,ui,config}`. Remote: `yugamTech/tracker`. **One branch = one
tenant = one school branch** (hard isolation; there is no `Branch` model — a branch is its own tenant).

## Current state (as of this handoff)
`main` is green in CI. Everything below is merged and verified (real tests re-run + code-read before each merge):
- **Admin visual redesign** (Quicksand/Nunito + `@yaanam/ui` icons/splats; all screens). Spec: `docs/design/admin-design-reference.html`.
- **P0 security**: 5 cross-tenant IDOR holes closed, refresh-token revocation, error-leak mask, socket teardown on logout/switch.
- **Test foundation**: real e2e harness (was silently no-opping) + tenant-isolation regression suite + unit suites. CI e2e job is blocking.
- **Perf pass**: virtualized lists, memoized live screens, single-flight token refresh.
- **Observability + lint**: Sentry (DSN-gated no-op), ESLint/Prettier installed & wired + blocking in CI/pre-commit.
- **Shifts** (AgeGroup surfaced as "Shift"): CRUD + shift-aware trip scheduling (`Trip.shiftId`, roster filtered to the shift).
- **School anchor**: `Tenant.schoolLat/Lng`, per-trip `anchor` override; `resolveSchoolAnchor` util; rendered on live maps.
- **Founder-issue batches 1 & 2**: photo-500 (body limit), routes direction-agnostic + unique name, drop-can't-be-skipped, driver history filter, school-aware notif copy, pull-to-refresh, bus-condition photos, curated→**now full** driver details to parents.
- **Parent trip experience**: `tripStatusLabel()` (label = f(trip.status, boardStatus), completed→terminal), `resolvePhotoUrl()` (fixes grey-box: prefixes relative `/uploads/…` to absolute), `pickTripRider`/`sortParentTrips` (trip-selection keyed on the trip's own riders, not the stale active child), nav-stack collapse-on-focus fix.

## Conventions the next chat MUST follow (this is why the work has held up)
1. **Tenant scope everything**: `findFirst({ where: { id, tenantId } })` + `@TenantId()` + `RolesGuard`/`@Roles`. NEVER `findFirstOrThrow` (it 500s) — use `findFirst` + `NotFoundException`(404)/`BadRequestException`(400)/`ConflictException`(409). DTOs use class-validator (global pipe: whitelist + forbidNonWhitelisted + transform).
2. **Verification loop (non-negotiable — a chat reporting "done/N passed" is NOT proof)**: after building, run `npm run typecheck` + `npm run lint` (both exit 0; warnings ok), and **actually run** the tests. Paste REAL output. The main chat then re-reads correctness-critical code + re-runs the suite before merge.
3. **Running e2e locally**: `docker compose -f docker/docker-compose.test.yml up -d` (Postgres :5433, Redis :6380). Migrate: `DATABASE_URL=postgresql://saarthi:saarthi_secret@localhost:5433/saarthi_test?schema=public npm run db:migrate:prod --workspace=backend/api`. Run: same DATABASE_URL + `REDIS_PORT=6380 OTP_BYPASS_MODE=true OTP_BYPASS_CODE=123456 NODE_ENV=test npm run test:e2e --workspace=backend/api`. e2e specs mirror `main.ts` bootstrap (ValidationPipe + HttpExceptionFilter + ResponseInterceptor), get tokens via OTP bypass, read `body.data.*`. CI (`.github/workflows/ci.yml`) sets the bypass env + services; migrations applied via `db:migrate:prod` (NOT `db:push` — no such script).
4. **Workflow**: build on a branch → verify → merge `--no-ff` to main → push → CI green. One commit per logical item. Pre-commit hook runs workspace typecheck + lint.
5. **Gotchas**: `@yaanam/api-client` resolves to `src` (no build step); `@yaanam/types` resolves to `dist` (**rebuild after editing types**). Login dev-IP auto-heals via `resolveDevHost` (no .env editing). **MapLibre (live map) needs a real/dev build — Expo Go shows a fallback tile.** After adding files under a workspace pkg, apps may need `npx expo start -c` (stale Metro cache). Stored-photo `<Image>` must use `resolvePhotoUrl()` (relative `/uploads/…` → absolute).
6. **Key reusable pieces**: `trips.service.ts` `scopeForActor` (role-scoped trip queries) + `curatedDriverFor`; `school-anchor.util.ts`; `trip-status-label.ts`; `resolvePhotoUrl`; `trip-selection.ts`.

## Remaining backlog (what's left)
**A. Parent UI design pass (wanted next, high bar).** The logic is right but the *styling/engineering* isn't at bar. Home must show ALL of today's trips per child, ordered: **live/running on top (hero, big Track-live CTA), then not-boarded/exceptions, then upcoming, then completed**. Every card must make the child's situation instantly legible and one-tap to the live map. Treat it like the admin redesign — reuse the `@yaanam/ui` foundation + design-reference language. Presentation only; keep `tripStatusLabel`/`sortParentTrips` as the source of truth.

**B. Scheduling & resource edge cases (backend validation — currently MISSING, this is the gap the founder hit).** No conflict checks exist. Add, at trip create/edit, tenant-scoped guards with clear 409/400s:
- **Duplicate trip**: same route + direction + shift + date/time → reject.
- **Vehicle double-booked**: same vehicle with a time-overlapping trip → reject (respect shift windows).
- **Driver/conductor double-booked**: same person overlapping → reject.
- **Shift overlap**: two shifts on one vehicle whose windows overlap.
- **Past-date / invalid time**; **empty route** (no stops / no students in the shift); **inactive driver / expired licence**; **seat capacity** (riders > vehicle.capacity).
Write unit + e2e for each. (There is intentionally no "one trip per route/date/direction" guard today — shifts made that legal; the guard must key on the full resource+time tuple.)

**C. Ride replay** — backend `GET /tracking/trips/:tripId/replay` exists; the parent replay screen is a stub. Build map + path playback.

**D. Payments (BLOCKED on founder input)** — only invoice read exists; `pay`/`mandate`/`webhook`/reconciliation/receipts unbuilt. Needs the fee model first: **slab vs per-km, billing cycle, one-way vs round-trip pricing** (ask the founder). Then: fee schema → invoicing → gateway adapter → webhook → reconciliation → receipts.

**E. Other epics** — Founder AI/analytics (PRD-06, needs a design pass); DPDP consent first-login enforcement (table+screen exist, gate not wired — launch dependency); complaint escalation broadcast + SLA auto-re-escalate; ride-ratings persistence (no save endpoint); WhatsApp/SMS delivery (stubs; blocked on BSP template approval — start that paperwork now).

## Recommended next order
1. **Parent UI design pass (A)** — highest felt-quality gain.
2. **Scheduling edge cases (B)** — correctness the founder is actively hitting.
3. **Ride replay (C)** — small, backend ready.
4. Payments (D) once the fee model lands; Founder AI (E) after a design pass.

PRDs live in `PRDS/` (gitignored). Project memory: `~/.claude/.../memory/` (see `code-quality-roadmap.md`, `parent-trip-experience.md`).
