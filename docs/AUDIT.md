# Yaanam — Pre-Handoff Audit (2026-07-02)

Companion to `docs/HANDOFF.md`. Point the new master chat at **both**:
*"Read `docs/HANDOFF.md` and `docs/AUDIT.md`, then continue."*

## How this was produced (and what's actually verified)
A 9-lens audit (dead-code, backend correctness/perf/security, all 3 apps, shared
packages, planned-vs-built) was fanned out over the monorepo. The first run tripped
the session rate-limit partway; a second lean run completed the rest, so **all 9
lenses are now done**.

Every **CRITICAL/HIGH** security item was **re-verified by hand** (files read at the
cited lines) before being written down. The perf / dead-code / structure findings
come from the completed lenses with file:line evidence — high-confidence, but confirm
at the cited line before acting.

---

## Completion assessment — is "~80% done" fair?
**~80% of features are *scaffolded* — but not ~80% *deployable to real parents*.**
The core loop works end-to-end (live tracking, attendance, notifications, shifts,
school-anchor, admin redesign, the parent trip experience). But between here and
"hand it to a real school" sit: a **second wave of access-control holes** (below),
a **payments stub behind real UI**, a **fake ride-rating screen**, a **replay stub**,
**no scheduling/resource conflict validation**, **no driver offline resilience**
(safety-critical), a **parent home that doesn't auto-go-live**, and a **timezone bug**
that mis-fires every time window once deployed off-IST.

Honest read: **feature-scaffold ~80%, production-quality ~60–65%.** The remaining
35–40% is the hard, unglamorous part (security hardening, payments, edge cases,
resilience) — exactly the work that separates a demo from a product.

---

## 1. Security — a SECOND WAVE of access-control holes (all hand-verified)
The earlier P0 pass was real but **not a systematic sweep**: it fixed the tracking
*read* path but missed *ingest*; fixed invoices-per-student but left the tenant-wide
list ungated; and never touched persons/students/cancel-pickup/structured-messages.
**Do a full authz sweep of every controller before any deploy.**

| # | Severity | Hole | Location | Fix |
|---|----------|------|----------|-----|
| S1 | **CRITICAL** | `cancel-pickup` — any authenticated user cancels **any child's** pickup, cross-family AND cross-tenant. No `@Roles` (so `RolesGuard` no-ops), and the service looks up the rider by `{tripId, studentId}` with **no tenant / no guardianship check**; the caller's tenant is never even passed in. | `trips.controller.ts:359-366` + `trips.service.ts:1460-1473` | Pass the full `ActiveMembership`; require the trip is in the caller's tenant AND the caller guards `studentId`. |
| S2 | **HIGH** | `GET /payments/invoices` has **no role guard** — any tenant user (parent/driver) reads the whole school's fees/amounts/receipts. | `payments.controller.ts:14-22` | `@Roles(ADMIN, TRANSPORT_MANAGER)` on the tenant-wide list; add a separate guardian-scoped endpoint for parents. |
| S3 | **HIGH** | `GET /persons` has **no role guard** — any tenant user dumps the full directory (every parent/staff phone + email). | `persons.controller.ts:22-25` | Gate behind `@Roles(ADMIN, TRANSPORT_MANAGER)`; keep `/persons/me` self-scoped. |
| S4 | **HIGH** | `GET /students` + `/students/:id` have **no `@Roles`** (class has `RolesGuard`, but it returns `true` when no roles are set — confirmed `roles.guard.ts:16`) → any driver/parent enumerates all students + guardian names/phones. | `students.controller.ts:41-54` | Add `@Roles(ADMIN, TRANSPORT_MANAGER)` to `list`/`findOne`; parents already use `/students/my`. |
| S5 | **HIGH** | Tracking **ingest** accepts pings for another tenant's trip and from any role → **cross-tenant GPS injection**. Read paths call `assertTripInTenant`; `ping`/`ping/batch` do not, and `ingestBatch` resolves `meta?.tenantId ?? tenantId` (persists under the *trip's* tenant and fans out to its rooms). | `tracking.controller.ts:20-34` + `location.service.ts:182-197` | Assert the trip is in the caller's tenant before ingest (reject on mismatch, don't silently override); restrict to `@Roles(DRIVER, CONDUCTOR)`. |
| S6 | **HIGH** | Structured driver messages: **cross-tenant read + write** on a bare `tripId`. Controller passes no tenantId; service scopes by `tripId` only. Any user can read any trip's messages and post `RUNNING_LATE`/`NOT_COMING_TODAY` onto any active trip. | `structured-messages.controller.ts:20-28` + `.service.ts:11-39` | Pass `ActiveMembership`; verify trip-in-tenant on both; for send, require the sender is the trip's crew or an admin. |
| S7 | **HIGH** | No brute-force / rate limiting on OTP verify or request. 6-digit code, 5-min window, no attempt cap → brute-forceable once bypass is off; unlimited `/otp/request` = SMS-bomb / cost abuse. | `otp.service.ts:33-38` + `auth.service.ts:17-21` | Redis attempt counter (lock after ~5 fails) + per-phone/IP throttle on request (Nest `ThrottlerModule`). |
| — | MED | `notifications markRead` + device-token delete are IDOR (no ownership scope); attendance photo upload has no role guard / MIME-size validation; complaint create trusts client `studentId/tripId` with no tenant/guardianship check; Socket.IO gateway CORS `origin:'*'`. | see finder notes | scope writes to the caller; validate; reuse REST CORS allow-list. |
| — | LOW | No refresh-token rotation/revocation (leaked token replayable 30d). | `token.service.ts:20-31` | per-session `jti` in Redis + rotate + revoke endpoint. |

**Verified NOT a hole (finder was right to de-rank):** `trips.service.findById` does
`findUniqueOrThrow` then a tenant check — cross-tenant reads ARE blocked; the only
defect is a bogus id → 500 instead of 404 (error hygiene, LOW).

---

## 2. Correctness & concurrency (backend) — *(carried, spot-verified)*
- **Attendance BOARDED idempotency is check-then-write with no DB unique constraint** — concurrent taps (double-tap/retry/driver+conductor) double-write the event and double-fire the parent push; the 60s Redis dedup "can lapse." Fix: `@@unique([tripId, studentId, type])` + catch P2002, or a transaction with a guarded `updateMany`. `attendance.service.ts:77-123`.
- **Geofence NOT_BOARDED flip + event insert + notify run outside a transaction** with no per-stop idempotency → a replayed/racing ping batch can re-flip riders and double-fire the most sensitive parent alert. Fix: one `$transaction` + Redis `SET NX` before the flip + `@@unique([tripId,stopId,event])`. `geofence.service.ts:41-89`.
- **Trip start/complete/transition is check-then-update, not atomic** → double-start race + "one live trip per driver" is not enforced under concurrency. Fix: conditional `updateMany({ where:{ id, status: from } })`, treat `count===0` as a lost race (409); optional `version` column. `trips.service.ts:584-609, 654-746`.
- **`findFirstOrThrow`/`findUniqueOrThrow` on user-supplied ids** → raw Prisma P2025 as HTTP 500 instead of 404. `trips.service.ts:220,1470`, `complaints.service.ts:42`, `ratings.service.ts:42`, `auth.service.ts:124`, `persons.service.ts:9,24`.
- **Onboarding commit runs the whole import in one interactive transaction (default 5s timeout)** → a large valid import rolls back on timeout with a confusing error. Fix: explicit timeout/`maxWait` or chunked batches. `onboarding.service.ts:73-89`.
- **Daily-check idempotency is a non-atomic findFirst-then-create** → concurrent submits create duplicates. Same fix pattern as attendance. `daily-checks.service.ts:61-95`.

## 3. Timezone — will bite in production *(verified real)*
`deriveScheduledStart`/`applyHHMMToDate` use `setHours` in the **server's** local
timezone. On a UTC prod server with IST tenants, a `07:30` shift becomes `07:30 UTC =
13:00 IST`, throwing off the ±60-min start window, the 30-min pickup-cancel cutoff,
the 2h daily-check window, and the overdue sweeps. Fix: resolve a tenant timezone and
build the instant in that zone (Luxon/date-fns-tz), or at minimum pin
`TZ=Asia/Kolkata`. `trips.service.ts:43-49, 1044-1063`.

## 4. Performance & database — *(now swept)*
Rough priority order:
- **Notification dispatch fans out strictly sequentially** (per recipient × per channel): dedup + preference lookup + `notification.create` + device-token lookup + FCM send, all serialized. A 40-parent route = hundreds of serial round-trips; many buses firing at once can starve foreground requests. Fix: `Promise.all` per recipient, batch the preference + device-token lookups (`findMany … { in }`), `createMany` the PENDING rows. `notifications.service.ts:47-136`.
- **Unbounded list endpoints with deep includes** — students / members / complaints / invoices / trips all `findMany` the whole tenant with nested joins and no `take/skip` (only notifications paginate). Add cursor/offset pagination (mirror `NotificationsService`); default `trips.list` to a bounded window when no date filter. `students.service.ts:43`, `members.service.ts:74`, `complaints.service.ts:109`, `invoices.service.ts:8`, `trips.service.ts:133`.
- **Missing DB indexes on hot filters** (add + `prisma migrate`): `Student(tenantId, routeId, status)` **[HIGH — roster build + capacity check on every schedule]**, `Guardianship(personId)` [every parent trip list/detail], `LocationPing(tenantId)` [highest-write table — retention/analytics seq-scan today], `AttendanceEvent(studentId)` [DPDP delete-eligibility]. `schema.prisma`.
- **`getFleet` N+1** — a Redis round-trip (+ DB fallback) per active trip; batch with `MGET` + one grouped `findMany`, and pass the known `vehicleId` in to skip `getTripMeta`. `location.service.ts:273-301`.
- **`getHistory` unbounded** — returns every ping for a trip (thousands on a long trip); paginate or route the UI through the already-downsampled `getReplay`. `location.service.ts:303`.
- **Independent awaits run serially** — trip create/edit validates route/vehicle/driver/conductor/shift/roster one-by-one (4–6 round-trips); `getRoster` does 3 serial queries and over-fetches full student/stop rows; `markNotBoarded` runs the same predicate as a `findMany` then an `updateMany`. All → `Promise.all` / reuse the fetched ids.

## 4b. Client / shared-package correctness — *(now swept)*
- **HIGH — the server's error text never reaches users.** The backend error envelope is `{ error: { code, message } }`, but **42** app call sites read `response.data.message` (always `undefined`) while only 14 read the correct `…data.error.message`. So a meaningful rejection ("trip already started", "pickup cutoff passed", "vehicle already checked today") is silently swallowed and a generic "Failed to save" shown. Fix: add one `getApiErrorMessage(e, fallback)` helper in `@yaanam/api-client`, export it, and replace the ad-hoc chains. `http-exception.filter.ts:71-78` + 42 consumers.
- **`retry: 2` retries deterministic 4xx** (403/404/400) twice before surfacing — wasted latency + 3× load on permanent failures. Add a predicate that only retries transient (≥500 / network) errors. `query-client.ts:8`.
- Over-broad notification cache invalidation (`invalidateQueries(['notifications'])` also nukes preferences + the 10s-polling driver-messages); socket auth passes `token: null` when unauthenticated. Minor. `notifications.hooks.ts`, `socket.client.ts:16`.

---

## 5. Parent app — distance to the "Uber bar" *(verified)*
The two hero screens (`home/index.tsx`, `track/[tripId].tsx`) are genuinely close —
full `@yaanam/ui` foundation, correct tokens, `resolvePhotoUrl`, deterministic
live-first ordering via `sortParentTrips`, escalating arrival alarm, the stale-child
fix. The gap to elite is **not** those two screens; it's:
- **P1 (correctness):** `useTodayTrips` has **no polling / focus-refetch / socket invalidation** → the home hero does NOT flip to live/Track-live when the bus starts until a manual pull-to-refresh. This silently breaks the single most important home behaviour. Fix: `refetchInterval` + `refetchOnWindowFocus`, ideally socket-invalidate `tripKeys.today()` on `trip:status`. `trips.hooks.ts:21-25`.
- **P2 (trust):** ride-rating screen is a **no-op** — imports no api-client, submit just flips local state and shows a thank-you; the parent's feedback is discarded. Either wire a real ratings endpoint or hide the CTA behind a flag. `ratings/ride.tsx`.
- **P3:** `trips/[tripId]/index.tsx` dropped off the design system (raw `TouchableOpacity`, flat banner, weak a11y) — inconsistent with the polish everywhere else.
- **P4 (perf):** home renders cards in an unvirtualized `ScrollView` with per-card inline closures; memoize `sortedTrips` and extract a `React.memo` card. Bounded (today only) so low urgency.

## 6. Driver app — failure/offline dimension is the weak spot *(verified)*
Happy path is solid and safety-minded. The gaps are all in failure handling — which
matters most for an on-the-road safety app:
- **D1 (safety):** location pings are fire-and-forget with **no offline queue**. The `trip.store` buffer was designed but is **completely unwired dead code** (zero consumers) — any signal gap silently loses the bus off the map. Wire the buffer: on disconnect push fixes, on reconnect drain in `sequence` order; persist to MMKV so a backgrounded relaunch survives. `socket.client.ts:66-68` + `store/trip.store.ts`.
- **D2:** boarding photo uploaded as full-res base64 JSON, no resize → slow/timeout on cellular while a child waits at the door. Downscale (`expo-image-manipulator` ~800px) or multipart upload. `attendance/photo.tsx:40,55-57`.
- **D3:** marking a rider has no optimistic update / retry / offline queue — a failed mark is signalled only by a transient toast. Add `onMutate` + rollback + retry. `attendance/[stopId].tsx:36-47`.
- Minor: vehicle-check shutter lacks the in-flight guard the boarding screen has (double-tap dup); the 1s elapsed timer re-renders the whole live stop list every second (battery on a multi-hour trip); "board without photo" is un-confirmed/un-logged; background-permission loss mid-trip looks identical to a signal gap.

---

## 7. Dead code / cleanup — *(now swept)*
Confirmed removable (zero consumers, verified by grep):
- **Dead zustand stores:** `apps/parent-app/store/trip.store.ts` (`useTripStore`) and `apps/admin-app/store/fleet.store.ts` (`useFleetStore`) — neither is imported anywhere.
- **Dead admin screens (pre-redesign leftovers):** `people/students/index.tsx` + `people/staff/index.tsx` are unreachable (the live `people/index.tsx` renders its own tabs); ~250 lines drifting out of sync. Delete + drop their `PARENT_ROUTE` entries in `lib/nav.ts` (keep `[id]`/`new`).
- **Dead route:** parent `track/trip-detail/[tripId].tsx` (registered at `track/_layout.tsx:16`, never navigated). Remove file + `Stack.Screen` + `lib/nav.ts` key.
- **Dead `@yaanam/ui` exports:** `ConfirmDialog`, `FormField`, `Splat` (admin uses its own `forms.tsx`); `Placeholder` in admin `widgets.tsx`.
- **Dead api-client exports:** `useSwitchContext` + `useMemberships` (context-switch never wired, though `setActiveMembership`→`disconnectSocket` waits for it); `tripsApi.getMyTrips`.
- **Stubs behind first-class CTAs** (build or hide): ride replay, ride ratings.
- **Config junk:** committed `turbo.json` but turbo is never installed/invoked; a stray root `tsconfig.json` (Expo base — **already removed in this branch**); root `package.json` carries an app-only `@maplibre/maplibre-react-native` runtime dep that belongs only in the apps + ui.
- **Stale rename leftovers:** `chats/*` planning docs still say "Saarthi"; `ci.yml` uses `POSTGRES_USER: saarthi` and triggers on a `master` branch the repo doesn't use. Harmless but confusing next to the maintained `docs/` set — keep `chats/` as history, but `docs/HANDOFF.md` + this file are the source of truth.
- **NOT duplication (suspicion refuted):** admin `fleet/*` (live map + GPS/signal exceptions) vs `trips/*` (calendar/list + lifecycle exceptions) are legitimately distinct and both wired.

## 7b. Folder structure — verdict: HEALTHY, leave it alone (one refactor worth doing)
You asked whether to restructure before finishing. The audit's answer: **don't churn it.**
The `packages/{types, api-client, ui, config}` split is coherent and every package
(incl. `config`) has real consumers; `backend/api/src/modules/*` is cleanly
domain-partitioned; cross-app dependency versions (react, RN, expo, zustand,
react-query, axios, reanimated) are perfectly aligned with no drift; no logs/env/
`.DS_Store` committed; `PRDS/` + `data-incoming/` correctly gitignored.

**The one structural smell worth fixing** (deliberately, not urgently): **auth is
copy-pasted across all three apps** — `store/auth.store.ts` + `(auth)/{phone,otp,
context-switch}.tsx` are near-identical in admin/parent/driver, so a change to the
session / socket-teardown contract must be made in three places and has already
drifted in comments. Extract the shared auth store into `@yaanam/api-client` and a
small auth-screen scaffold into `@yaanam/ui`, each app passing only branding/role.
Everything else in the app trees is appropriately app-specific — keep it.

---

## 8. Planned-vs-built — what's missing or weak *(PRD-02a now fully diffed)*

**Correction to earlier drafts:** PRD-02a trip-lifecycle is **substantially BUILT (~90%)**, not the open gap the handoff implied. HANDLED (with file:line evidence): trip **abort + recovery** (`trips.service.ts:1229-1284`), **overdue/abandoned two-stage sweep** with auto-abort (`trips.service.ts:898-937` + `trip-overdue-sweep.service.ts`), **partial/early completion** with reason + exception (`:1094-1176`), **late-start** ±60-min window (`:703-740`), **complete-a-stale-trip guard** (`:1117-1124`), append-only **lifecycle audit trail** + admin timeline + driver Resume UI. So the "cancel/overdue/partial/late-start" edge cases are done.

**Real remaining lifecycle holes (new, from the diff):**
- **Vehicle breakdown / swap mid-route — MISSING.** `editScheduled` refuses any edit once a trip leaves SCHEDULED (`trips.service.ts:1742-1746`); the only mid-trip tool is `abort()`. A bus that breaks down mid-route can't be swapped — you abort and recreate, losing continuity. Operators *will* hit this. Add a live-trip vehicle-swap + substitute-driver path (mutate vehicle/driver on STARTED trips + audit row).
- **Signal-loss alert leaks to parents — spec deviation (FR-08).** `SIGNAL_LOST` is emitted to `trip:{id}` (which parents subscribe to) as `alert:critical` (`tracking.gateway.ts:350-353` → `socket.hooks.ts:66`). FR-08 says notify **admin, not parents** (avoid panic), and "attempt auto-resume" — **no auto-resume exists.** Route `SIGNAL_LOST`/`OVERSPEED` to admins-only unless a per-tenant flag says otherwise.
- **No-show (zero boarders) — PARTIAL.** Per-rider not-boarded on stop-departure works, but there's no trip-level "nobody boarded" signal/early alert.
- **Stop-skip / out-of-sequence — PARTIAL (by design, undocumented).** Geofence is forward-only per stop but there's no route-sequence enforcement / "skipped stop" event.
- **Thin tests on the new P0 machinery.** `trips.lifecycle.spec.ts` covers only the transition map + parent pre-check — the sweep, auto-abort, completion-window, force-complete, and acknowledge are **untested**. By this repo's own merge bar (HANDOFF §2), that's a gap on safety-critical code.

**Newly-surfaced PRD gaps (not previously catalogued):**
- **"Running late/early" push + "N stops away" (FR-15) — MISSING.** No `RUNNING_LATE`/`RUNNING_EARLY` notif category is dispatched, and ETA returns minutes only (no `stopsAway`). The late/early banner is client-only. (`RUNNING_LATE` exists only as a driver structured-message key — unrelated.)
- **Attendance immutability after completion (FR-20) — PARTIAL.** `mark()` has BOARDED idempotency but no guard blocking marks once the trip is COMPLETED (corrections should be a separate logged amendment).
- **Complaint creation broadcast (FR-09) — MISSING** even at the base level (day-one routing to Ops/Principal/Admin), not just SLA re-escalation. `COMPLAINT_ESCALATED` category exists but is never dispatched.

**Still stubbed / blocked (unchanged):**
- **Scheduling/resource conflict validation — MISSING** (the gap the founder hit): no duplicate-trip, vehicle/driver double-booking, shift-overlap, or past-date checks — confirmed absent in **both** the client (`new.tsx`, only guards empty-route) **and** the server (`create()`). Capacity + empty-route + inactive-staff *are* enforced. See HANDOFF §B.
- **Payments — STUB** (invoice read only, and ungated — see S2). Blocked on the fee model (slab vs per-km, billing cycle, one-way vs round-trip).
- **Ride replay — STUB**; **ride ratings — FAKE** (discards input, no backend).
- **DPDP consent gate — UNWIRED** (model + screen exist, no first-login enforcement).
- **WhatsApp/SMS delivery — STUBBED** (`notifications.service.ts` warn-and-skip, PUSH only; blocked on BSP template approval — start that paperwork now).
- **Founder AI / analytics (PRD-06) — zero scaffolding** (`analytics.module.ts` is an empty stub). By design, after the 3 apps are in use.
- **CCTV (FR-25) — MISSING** (P1, explicitly "don't block P0").

---

## 9. What to hand the new chat, and in what order
**Paste / point at:** `docs/HANDOFF.md` (state + conventions + backlog) **and this file**
(`docs/AUDIT.md`). Optionally `PRDS/PRD-02a-Trip-Lifecycle-Edge-Cases.md` and
`PRD-05-Payments.md` when starting those specific epics. Nothing else is needed — these
two docs carry the working context.

**Recommended order:**
0. ✅ **S1 (cancel-pickup IDOR) — DONE** (fixed + e2e regression + full suite green; this branch).
1. **Finish the security sweep (S2–S7)** — before anything ships. Ungated `persons`/`students`/`payments` lists, the tracking-ingest + structured-messages cross-tenant IDORs, OTP rate-limit. Do a controller-by-controller authz pass.
2. **Parent-UI: P1 (auto-go-live) + P2 (ratings) + P3 (design parity)** — highest felt-quality gain and directly the "Uber bar" ask.
3. **Scheduling edge cases (HANDOFF §B)** — the duplicate-trip / double-booking guards, confirmed absent in both client and server.
4. **Lifecycle gaps** — live-trip **vehicle-swap / substitute-driver** (breakdown recovery), route `SIGNAL_LOST`/`OVERSPEED` **admin-only** (FR-08), and **backfill tests** for the overdue-sweep / force-action machinery.
5. **Driver offline resilience (D1–D3)** — safety.
6. **Concurrency/idempotency + timezone + the error-envelope helper (§2, §3, §4b)** — before real load.
7. **Ride replay** — small, backend ready.
8. **Payments** once the fee model lands; **Founder-AI** after a design pass.

*Cheap, safe cleanups (any time): delete the dead stores/screens/exports in §7, remove `turbo.json` + the root `maplibre` dep, add the four DB indexes in §4, and fix the `saarthi`→`yaanam` CI naming.*

Keep the verify-then-merge loop: build on a branch → `typecheck` + `lint` + real
tests (Docker e2e) → re-read correctness-critical code → merge `--no-ff` → CI green.
