# Saarthi — Implementation Roadmap

> Companion to [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md).
> **Goal:** a practical, internship-friendly roadmap that reaches a demo-ready MVP *before* production integrations.

---

## Design principle

**Front-load the visible, low-risk surface (Phases 1–2) so there's always a working demo, then descend into the high-risk integrations (3 → 5) one vertical at a time.** Each phase ends demo-ready.

**Critical path:** Identity → Tracking → Notifications. Payments and Complaints are independent verticals that both lean on Notifications. Analytics is a pure downstream consumer (build last).

| Phase | Theme | Demo state at phase end |
|---|---|---|
| 1 | All screens + navigation (mock) | Every screen renders & navigates; looks real |
| 2 | Backend integration (CRUD + auth) | Real login, real people/routes/vehicles data |
| 3 | Tracking & Attendance | Live bus on map, real board/alight |
| 4 | Notifications & Complaints | Push alerts fire; complaint loop closes |
| 5 | Payments | Pay an invoice (sandbox); mandate setup |
| 6 | Founder dashboard & Analytics | Daily metrics + AI digest feed |

---

## Phase 1 — All screens & navigation with mock data
**Goal:** every screen renders, navigates, and looks real. Pure frontend.

- **Deliverables:** Complete the screen inventory across all 3 apps; finalize tab/drawer nav; shared `@saarthi/ui` components consumed everywhere; mock data modules per screen; auth gate working off `auth.store` (mock login). Add the missing screens (message-driver sheet, in-trip alerts, reconciliation queue).
- **Dependencies:** none (mock auth store).
- **Suggested order:** Auth flow → Parent (home→track→trip detail→complaints→payments→profile) → Driver (home→pre-trip→active→attendance→summary) → Admin (dashboard→people→fleet→routes→complaints→payments→settings).
- **Stays mocked:** everything — all data, all auth, all maps (static coordinates), all sockets.
- **Real integrations:** none. *(Optional: real Google Maps render with mock coordinates to de-risk map setup early.)*

## Phase 2 — Backend integration (CRUD + auth)
**Goal:** replace mock data with real REST calls for the non-realtime, non-money surfaces.

- **Deliverables:** Real OTP auth end-to-end (bypass code `123456` in dev); JWT + refresh + context switch + consent gate wired; `@saarthi/api-client` React Query hooks consumed by screens; Identity CRUD complete (members, guardians, vehicles, routes, stops, age-groups, tenants); **Onboarding module** (Excel template + dry-run validate + commit, `ImportBatch`); TenantGuard/RolesGuard enforced and tested (NFR-05 cross-tenant isolation tests).
- **Dependencies:** Phase 1 screens; Postgres + Redis (docker-compose already present); seed data.
- **Suggested order:** Auth wiring → persons/students read → CRUD writes → onboarding import → guard tests.
- **Stays mocked:** live GPS, attendance photos, payment gateway, notifications, analytics.
- **Real integrations:** Postgres, Redis (sessions/OTP). No external vendors yet.

## Phase 3 — Tracking & Attendance (the core, highest risk)
**Goal:** the heart of the product. De-risk background GPS **on day one** of this phase.

- **Deliverables:** EAS dev build for driver app (background location + foreground service); MMKV offline buffer (≥2h) + ordered flush; `POST /tracking/ping` batch ingest + dedup + `deviceTs` reconciliation; Socket.IO `/tracking` fan-out with Redis adapter + scoped room joins (NFR-02); `vehicle:{id}:latest` Redis cache; geofencing with hysteresis → `geofence_events`; ETA via Google Maps Directions (2-min Redis cache, one-call-many-parents); speed monitoring; signal-loss detection; trip cron generation; full trip lifecycle (start/complete/cancel/abort/cancel-pickup); attendance roster + board/alight + photo upload to Spaces + not-boarded automation; ride history + replay.
- **Dependencies:** Phase 2 (identity, trips, JWT for socket handshake).
- **Suggested order:** **GPS spike on physical device first** → ping ingest → socket fan-out → Redis latest-cache → parent live map → geofencing → ETA → attendance → not-boarded → history/replay → speed/signal-loss.
- **Stays mocked:** notification *delivery* (log to console / in-app feed only), payments, analytics, CCTV.
- **Real integrations:** **Google Maps Directions API**, **DigitalOcean Spaces** (photos), EAS build, Socket.IO + Redis adapter.

## Phase 4 — Notifications & Complaints
**Goal:** turn the events Phase 3 emits into delivered messages, and close the trust loop.

- **Deliverables:** **NotificationsModule** — event→notification pipeline, spec registry, recipient resolution, channel adapters (FCM primary; SMS/WhatsApp behind interfaces), dedup (Redis TTL), throttle, quiet hours, fallback chain, delivery-status tracking, idempotency, preferences API, device-token registration/pruning; structured parent→driver messages (`StructuredMessage` model); call-admin. **ComplaintsModule** — structured capture + auto-attach (GPS/speed/attendance from Phase 3), escalation broadcast, owner + SLA clock, SLA-breach cron (every 5 min), resolution journey state machine, ride + resolution ratings, KPI rollups; notification audit screen.
- **Dependencies:** Phase 3 (emits the events; auto-attach needs real trip data).
- **Suggested order:** Notification engine + FCM → complaint capture/auto-attach → escalation → SLA cron → resolution state machine → ratings → SMS/WhatsApp adapters last.
- **Stays mocked / deferred:** SMS & WhatsApp can stay **stubbed adapters** until DLT/BSP templates are approved (flagged launch blockers) — FCM + in-app feed carry the demo. Phone calling is product-Phase-2.
- **Real integrations:** **Firebase FCM** (real); **DLT SMS** + **WhatsApp BSP** (real once templates approved — adapter pattern lets them swap in without code change).

## Phase 5 — Payments (real money, highest blast radius)
**Goal:** fee config → invoice → pay → mandate setup → reconciliation. Webhook-as-truth.

- **Deliverables:** `PaymentGateway` interface with Cashfree + HDFC adapters (per-tenant selectable); server-side order init (idempotent); raw webhook storage (`gateway_webhooks`) + idempotent replayable handlers; one-time payment flow; receipts (PDF to Spaces, 7-yr retention); fee plan config + assignment; invoice cron (1st of month); mandate **setup** (`CREATED→ACTIVE` via webhook); admin collections dashboard + CSV export; reconciliation cron + mismatch queue; immutable payment ledger (paise integers). **Auto-debit *execution* stays product-Phase-2** (observed in pilot per PRD-05 §8.2).
- **Dependencies:** Phase 2 (students/fee assignment), Phase 4 (payment notifications), money-path e2e tests (mandatory).
- **Suggested order:** Gateway abstraction + sandbox → invoice generation → one-time pay + webhook → receipts → mandate setup → collections/export → reconciliation.
- **Stays mocked:** **gateway in sandbox mode** through the demo; auto-debit execution not built.
- **Real integrations:** **Cashfree/HDFC** (sandbox → prod pending KYC, a flagged launch blocker), DO Spaces (PDFs).

## Phase 6 — Founder Dashboard & Analytics
**Goal:** metrics engine (MVP, admin-facing) → Founder Web + AI digest (product-Phase-2).

- **Deliverables:** **AnalyticsModule** metrics cron (post-trip batch, default 7 PM/tenant), `metric_snapshots` as source of truth, all KPIs from PRD-06 §4.1, on-demand recompute, admin dashboard + 7-day trends (these are **MVP**); then `apps/founder-web` (React+Vite), agent feed, AI digest pipeline (compute-first/narrate-only via `LlmAdapter`), group roll-up, exception log, conversational Q&A (whitelisted parameterized queries, read-only, tenant-scoped).
- **Dependencies:** Phases 3–5 (all the data being aggregated).
- **Suggested order:** Metrics cron + snapshots → admin dashboard/trends (closes MVP) → founder-web shell → AI digest → Q&A.
- **Stays mocked:** Founder Web can demo against seeded `metric_snapshots`; AI digest can use a stub `LlmAdapter` returning canned narration before wiring the real model.
- **Real integrations:** **Claude API** via `LlmAdapter` (use `claude-opus-4-8` or `claude-haiku-4-5` for the cheap daily batch — one call/school/day; narration only, numbers pre-computed).

---

## Mocked-vs-real cheat sheet

| Capability | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|
| Auth / OTP | mock | **real** | real | real | real | real |
| Identity / CRUD / Onboarding | mock | **real** | real | real | real | real |
| Live GPS / tracking / attendance | mock | mock | **real** | real | real | real |
| Push (FCM) | mock | mock | mock | **real** | real | real |
| SMS / WhatsApp | mock | mock | mock | stub→real | real | real |
| Complaints loop | mock | mock | mock | **real** | real | real |
| Payments (sandbox) | mock | mock | mock | mock | **real** | real |
| Analytics / AI digest | mock | mock | mock | mock | mock | **real** |

---

## Launch-blocker watch (start these in parallel, early)

- **DLT SMS registration + template approval** — long lead time (PRD-03 risk).
- **WhatsApp BSP account + template approval** — long lead time.
- **Cashfree/HDFC merchant KYC + recurring-mandate enablement** — long lead time (PRD-05 risk).
- **DPDP consent legal copy + per-tenant DPA** — blocks parent activation.
- **EAS background-GPS spike on a physical Android device** — do it on day one of Phase 3.

These don't block the demo (stubs/sandbox cover it) but **do** block production, so the paperwork should run alongside Phases 1–4.
