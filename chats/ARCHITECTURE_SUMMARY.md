# Saarthi — Architecture Summary

> Grounded in the actual repo state (not just the PRDs).
> **Headline:** the Prisma schema is ~95% complete across all six PRDs, screens are scaffolded with mock data, but backend logic is thin and the frontend is almost entirely unwired. The work is *wiring and filling*, not greenfield building.

---

## Repo state at a glance

| Layer | State |
|---|---|
| **Prisma schema** | 42 models + 18 enums — covers every PRD incl. Phase-2 entities. Enums match PRD state machines exactly. |
| **Screens (3 apps)** | Entire MVP screen set exists as Expo Router files. **Only 3 screen files import `@saarthi/api-client`** — the rest are mock data. |
| **Backend modules** | Auth/Identity/Trips/Tracking/Attendance/Complaints/Payments exist (thin). `Onboarding`, `Notifications`, `Analytics` are **empty shells** (only `.module.ts`). |
| **Shared packages** | `@saarthi/ui`, `@saarthi/types`, `@saarthi/api-client` present and wired in the monorepo. |

---

# Part A — Screen Inventory (Purpose · Data · APIs · Entities)

## A.1 Parent App

| # | Screen | Purpose | Data Required | Backend APIs | DB Entities |
|---|--------|---------|---------------|--------------|-------------|
| P1 | Phone entry | Capture E.164 phone | — | `POST /auth/otp/request` | Person |
| P2 | OTP input | Verify 6-digit code, issue tokens | phone | `POST /auth/otp/verify` | Person, Membership |
| P3 | Consent (DPDP) | Blocking first-login consent | consent version | `POST /auth/consent` | Consent |
| P4 | Context switcher | Pick school+role if multi-membership | membership list | `GET /auth/memberships`, `POST /auth/context/switch` | Membership |
| P5 | Home | Child cards + live status chip | children, today's trips, board status | `GET /students` (mine), `GET /trips/today` | Student, Guardianship, Trip, TripRider |
| P6 | Live map | Moving bus marker, ETA, cancel-pickup, call admin | live position, ETA, stops, driver contact | `GET /tracking/:tripId/latest`, socket `/tracking`, `POST /trips/:id/cancel-pickup` | Trip, LocationPing, Stop, Vehicle |
| P7 | Trip detail | Stop-by-stop timeline + attendance result | trip stops, geofence events, attendance | `GET /trips/:id`, `GET /attendance/:tripId` | Trip, GeofenceEvent, AttendanceEvent |
| P8 | Past rides list | History per child | rides list | `GET /students/:id/rides` | Trip, TripRider, AttendanceEvent |
| P9 | Ride replay | Replay GPS path on map | downsampled path | `GET /trips/:id/replay` | TripPath/LocationPing |
| P10 | Complaints list | My complaints + status chips | complaint list | `GET /complaints` | Complaint |
| P11 | New complaint | Category grid, pre-filled ride context, photo | categories, trip context | `POST /complaints`, `GET /complaints/:id/context`, `POST /complaints/:id/attachments` | Complaint, ComplaintAttachment |
| P12 | Complaint detail | Visual resolution timeline | complaint + event log | `GET /complaints/:id` | Complaint, ComplaintEvent |
| P13 | Ride rating prompt | 1–5 star post-ride | trip context | `POST /ratings/ride` | RideRating |
| P14 | Resolution rating | Rate complaint handling | complaint id | `POST /ratings/resolution/:complaintId` | ResolutionRating |
| P15 | Fees home | Outstanding, invoice list, mandate badge | invoices, mandate status | `GET /invoices`, `GET /mandates` | Invoice, Mandate |
| P16 | Invoice detail | Line items, due date | invoice | `GET /invoices/:id` | Invoice, FeePlan |
| P17 | Payment flow | Gateway SDK handoff | order token | `POST /payments/initiate`, `GET /payments/:id` | Payment, Invoice, GatewayWebhook |
| P18 | Mandate setup | Authorize auto-debit | cap, cycle | `POST /mandates/initiate` | Mandate |
| P19 | Mandate status | Active badge, revoke, debit history | mandate, attempts | `GET /mandates/:id`, `POST /mandates/:id/revoke` | Mandate, AutoDebitAttempt |
| P20 | Payment history | Invoices + downloadable receipts | invoices, receipts | `GET /invoices`, `GET /receipts/:invoiceId/pdf` | Invoice, Receipt |
| P21 | Notification center | Chronological feed, deep-link | notifications | `GET /notifications`, `PATCH /notifications/:id/read` | Notification |
| P22 | Notification prefs | Per-category channel toggles | preferences | `GET/PUT /notifications/preferences` | NotificationPreference |
| P23 | Profile | Name, locale | person | `GET/PATCH /persons/me` | Person |
| P24 | Message driver sheet | Structured quick-messages | message set | `POST /messages/driver` | StructuredMessage* |

## A.2 Driver App

| # | Screen | Purpose | Data Required | Backend APIs | DB Entities |
|---|--------|---------|---------------|--------------|-------------|
| D1 | Phone entry | Phone capture | — | `POST /auth/otp/request` | Person |
| D2 | OTP input | Verify | phone | `POST /auth/otp/verify` | Person, Membership |
| D3 | Context switcher | Multi-school driver/conductor | memberships | `GET /auth/memberships` | Membership |
| D4 | Home | Today's assigned trips (pickup/drop cards) | assigned trips | `GET /trips/today` | Trip, VehicleAssignment |
| D5 | Pre-trip | Route overview, stops, start button | route, stops, roster | `GET /trips/:id` | Trip, Route, RouteStop, TripRider |
| D6 | Active trip | Live map, streaming health, ETA, stop progress | GPS state, next stop | `PATCH /trips/:id/start`, socket `driver:ping` | Trip, LocationPing, GeofenceEvent |
| D7 | Stop attendance | Per-stop roster, BOARDED/NOT_BOARDED toggle | roster per stop | `GET /trips/:id/stops/:stopId/roster`, `POST /attendance` | TripRider, AttendanceEvent, Stop |
| D8 | Attendance photo | In-app camera, preview, confirm | photo upload | `POST /attendance` (multipart) → Spaces | AttendanceEvent |
| D9 | Post-trip summary | Attendance %, exceptions, end-trip | trip summary | `PATCH /trips/:id/complete` | Trip, AttendanceEvent |
| D10 | Vehicle daily check | Photo + checklist | checklist | `POST /vehicle-check`* | Vehicle (+ VehicleCheck*) |
| D11 | In-trip alerts panel | Incoming structured parent messages | messages | `GET /messages/driver/:tripId` | StructuredMessage* |

## A.3 Admin App

| # | Screen | Purpose | Data Required | Backend APIs | DB Entities |
|---|--------|---------|---------------|--------------|-------------|
| AD1–3 | Phone / OTP / Context | Auth | — | auth endpoints | Person, Membership |
| AD4 | Dashboard | Today's KPIs, exceptions, SLA health | metric snapshot | `GET /analytics/today` | MetricSnapshot |
| AD5 | Trends | 7-day charts | history snapshots | `GET /analytics/trends`, `/history` | MetricSnapshot |
| AD6 | People list | Filter by role | members, students | `GET /members`, `GET /students` | Membership, Student |
| AD7 | Student detail | Info, guardians, route, stop | student | `GET /students/:id`, `/guardians` | Student, Guardianship |
| AD8 | Student create/edit | CRUD | route/stop/agegroup lists | `POST/PATCH /students` | Student |
| AD9 | Staff list/detail | Drivers, conductors | members | `GET /members?role=` | Membership, VehicleAssignment |
| AD10 | Bulk import wizard | Download → upload → preview → commit | template, dry-run result | `GET /onboarding/templates/:type`, `POST /onboarding/import/:type`, `/commit` | ImportBatch |
| AD11 | Import preview | Dry-run errors | batch result | `GET /onboarding/batches/:id` | ImportBatch |
| AD12 | Import result | Final counts | committed batch | (commit response) | ImportBatch |
| AD13 | Vehicle list/detail | CRUD vehicles | vehicles | `GET/POST/PATCH /vehicles` | Vehicle |
| AD14 | Route list | Routes | routes | `GET /routes` | Route |
| AD15 | Route detail | Ordered stops, geofence radii, schedule | route + stops | `GET /routes/:id`, `POST /routes/:id/stops` | Route, RouteStop, Stop, AgeGroup |
| AD16 | Fleet map | All active buses | live fleet | socket `subscribe:fleet`, `GET /fleet` | Trip, Vehicle, LocationPing |
| AD17 | Trip monitor | Active trips + exception count | active trips | `GET /trips?status=`, `GET /fleet/exceptions` | Trip, GeofenceEvent, SpeedEvent |
| AD18 | Trip detail (admin) | Roster status, signal health | trip detail | `GET /trips/:id` | Trip, TripRider, AttendanceEvent |
| AD19 | Exceptions feed | Not-boarded, signal-loss, over-speed | exceptions | `GET /fleet/exceptions` | SpeedEvent, GeofenceEvent, TripRider |
| AD20 | Trip history | Searchable history | trips | `GET /trips` | Trip |
| AD21 | Complaint queue | Filter by status/SLA/owner | complaints | `GET /complaints` | Complaint |
| AD22 | Complaint detail (admin) | Context panel, state transitions, notes | complaint + context | `GET /complaints/:id`, `PATCH /complaints/:id/status` | Complaint, ComplaintEvent |
| AD23 | KPI dashboard (complaints) | SLA health, by-driver/route | aggregates | `GET /analytics/...`, `/ratings/summary` | Complaint, RideRating, MetricSnapshot |
| AD24 | Fee plan config | Create/edit plans, GST, applicability | fee plans | `GET/POST/PATCH /fee-plans` | FeePlan |
| AD25 | Collections dashboard | Collected/due/overdue, mandate % | collections summary | `GET /admin/collections` | Invoice, Payment, Mandate |
| AD26 | Student fee assignments | Bulk plan view | assignments | `PUT /students/:id/fee-assignment` | RiderFeeAssignment |
| AD27 | Invoice management | List, generate, cancel, remind | invoices | `GET /invoices`, `POST /invoices/generate` | Invoice |
| AD28 | Reconciliation queue | Mismatch list, resolve | mismatches | `GET /admin/reconciliation`, `PATCH .../resolve` | GatewayWebhook, Payment |
| AD29 | Settings | Authority numbers, feature flags | tenant config | `PATCH /tenants/:id` | Tenant |
| AD30 | Notification audit | Delivery status per event | notifications | `GET /admin/notifications/audit` | Notification |

## A.4 Founder Web (Phase 2 — design now, build later)

| # | Screen | Purpose | APIs | Entities |
|---|--------|---------|------|----------|
| F1 | Email+OTP login | Web auth | `POST /auth/otp/request` (email channel) | Person |
| F2 | Agent feed | Daily digest timeline per school+group | `GET /agent/feed`, `/feed/group`, `POST /agent/posts/:id/react` | AgentFeed, AgentPost, PostReaction, PostComment |
| F3 | Analytics dashboard | KPI trends, filters | `GET /analytics/trends` | MetricSnapshot |
| F4 | Group roll-up | Cross-school league table | `GET /analytics/...` (group scope) | MetricSnapshot |
| F5 | Exception log | Historical safety exceptions | `GET /analytics/exceptions` | SpeedEvent, GeofenceEvent |
| F6 | Ask the data | Conversational Q&A | `POST /agent/ask` | AnalyticsQuery |

`*` = entity/endpoint in PRD but **not yet confirmed in the Prisma schema** (see gap analysis).

---

# Part B — Architecture Diagrams

## B.1 Screen Architecture (grouped)

```
PARENT          DRIVER           ADMIN                    FOUNDER (P2)
─ Auth ─        ─ Auth ─         ─ Auth ─                 ─ Auth(email) ─
 phone           phone            phone                    agent feed
 otp             otp              otp                       analytics
 consent         context-switch   context-switch            group roll-up
 context-switch ─ Trips ─        ─ Ops ─                    exception log
─ Track ─        home             dashboard / trends         ask-the-data
 home(children)  pre-trip         fleet map
 live map        active trip      trip monitor/detail
 trip detail     stop attendance  exceptions feed
 past rides      attend. photo   ─ Data ─
 replay          post-trip        people (students/staff)
─ Complaints ─   vehicle check    student/vehicle/route CRUD
 list/new/detail in-trip alerts   bulk import wizard
 rating         ─ Payments ─     ─ Complaints ─
─ Payments ─                      queue/detail/KPIs
 fees/invoice                    ─ Payments ─
 pay/mandate                      fee plans/collections
 history                          invoices/reconciliation
─ Profile ─                      ─ Settings ─
 profile/notif prefs              authority#/flags/audit
```

## B.2 Navigation Architecture

All three apps use **Expo Router v3 file-based routing** with two route groups already in place:

- `(auth)` stack → `phone → otp → [consent (parent)] → [context-switch]`
- `(app)` → **Parent & Driver: bottom tabs**; **Admin: drawer/tabs** (more sections)
- Root `index.tsx` is the gate: reads `auth.store` → redirects to `(auth)` or `(app)`.
- Deep links: FCM `data` payload routes into `(app)/track/[tripId]` or `(app)/complaints/[id]`.

```
Root _layout (auth gate via Zustand auth.store)
 ├── (auth)/_layout  [stack]
 └── (app)/_layout   [tabs or drawer]
       ├── tab: Home/Track
       ├── tab: Trips/History
       ├── tab: Complaints
       ├── tab: Payments
       └── tab: Profile/Settings
```

## B.3 Backend Module Architecture (NestJS modular monolith)

```
AppModule
├── Infra: PrismaModule · RedisModule · StorageModule(Spaces) · ScheduleModule
├── Common: TenantGuard · RolesGuard · JwtAuthGuard · TenantContextMiddleware · AuditInterceptor
├── AuthModule          ✅ (otp, token, verify, refresh)
├── IdentityModule      ✅ (persons, students) ⟶ needs: members, guardians, vehicles, routes, stops, age-groups, tenants
├── OnboardingModule    🟥 empty shell ⟶ Excel import + dry-run + commit
├── TripsModule         ✅ partial ⟶ needs: cron generation, cancel, manual create, cancel-pickup
├── TrackingModule      ✅ gateway + location ⟶ needs: geofencing, ETA cache, speed, signal-loss
├── AttendanceModule    ✅ partial ⟶ needs: roster, photo upload, not-boarded automation
├── NotificationsModule 🟥 empty shell ⟶ engine, channel adapters (FCM/SMS/WhatsApp), specs, dedup
├── ComplaintsModule    ✅ partial ⟶ needs: escalation, SLA cron, state machine, ratings
├── PaymentsModule      ✅ partial ⟶ needs: gateway abstraction, webhooks, mandates, reconciliation
└── AnalyticsModule     🟥 empty shell ⟶ metrics cron, snapshots, agent feed/digest (P2)
```

## B.4 Database Mapping

The schema already contains **42 models + 18 enums** covering every PRD. Models map 1:1 to the PRD "Data Model (Key Tables)" sections, and the enums (`TripStatus`, `ComplaintStatus`, `InvoiceStatus`, `MandateStatus`, `RiderStatus`) match the PRD state machines exactly. Redis keys (`vehicle:{id}:latest`, `geofence:{tripId}:{stopId}`, `eta:...`, `session:{token}`, OTP) are ephemeral and live outside Prisma.

**Models present:** Person, Tenant, Membership, Student, Guardianship, Vehicle, VehicleAssignment, Route, Stop, RouteStop, AgeGroup, Consent, Trip, TripRider, LocationPing, GeofenceEvent, SpeedEvent, AttendanceEvent, PickupCancellation, Complaint, ComplaintEvent, ComplaintAttachment, ResolutionRating, RideRating, FeePlan, RiderFeeAssignment, Invoice, Payment, Receipt, Mandate, GatewayWebhook, DeviceToken, Notification, NotificationPreference, MetricSnapshot, AgentFeed, AgentPost (+ enums).

## B.5 Feature Dependency Graph

```
PRD-01 Identity/Auth ──────────────► (required by everything)
        │
        ├──► Onboarding (Excel import)
        │
PRD-02 Tracking/Trips/Attendance ──► emits events ──┐
        │                                            │
        ├──► geofence/speed/attendance data ─────────┼──► PRD-04 Complaints (auto-attach)
        │                                            │
        └──► trip data ──────────────────────────────┼──► PRD-06 Analytics (metrics)
                                                      │
PRD-03 Notifications ◄── consumes events from ───────┴── PRD-02, PRD-04, PRD-05
        (delivery infra — every module depends on it)
        │
PRD-05 Payments ──► collections data ──► PRD-06 Analytics
        │
        └──► invoice/payment events ──► PRD-03 Notifications
```

**Critical path:** Identity → Tracking → Notifications. Payments and Complaints are independent verticals that both lean on Notifications. Analytics is a pure downstream consumer (build last).

---

# Part C — Repository Gap Analysis

### Screens
- **Existing (scaffolded with mock data):** Essentially the *entire* MVP screen set across all 3 apps — auth, parent track/trips/complaints/payments/profile, driver trip/attendance/vehicle-check, admin dashboard/people/fleet/routes/complaints/payments/settings. **Only 3 screen files import `@saarthi/api-client`** — the rest are mock.
- **Missing screens:** Parent *message-driver sheet*, *call-admin* affordance; Driver *in-trip alerts panel*; Admin *notification audit detail*, *reconciliation queue* (folder exists, screen thin); **all Founder Web screens** (no `apps/founder-web` yet — Phase 2).

### Backend modules
- **Existing & real:** `AuthModule` (otp/token/verify/refresh), `IdentityModule` (persons + students), partial `TripsModule`, `TrackingModule` (gateway + location), `AttendanceModule`, `ComplaintsModule`, `PaymentsModule` (invoices).
- **Empty shells (only `.module.ts`):** `OnboardingModule`, `NotificationsModule`, `AnalyticsModule`.
- **Missing logic inside existing modules:** trip cron generation, geofencing + ETA cache, speed monitoring, signal-loss detection, not-boarded automation, complaint escalation + SLA cron + state machine, payment gateway abstraction + webhook ingestion + mandates + reconciliation, members/guardians/vehicles/routes/stops/tenants CRUD controllers.

### Database entities
- **Existing:** 42 models cover all six PRDs — including Phase-2 entities (`AgentFeed`, `AgentPost`, `MetricSnapshot`, `Mandate`, `GatewayWebhook`, `Consent`, `NotificationPreference`).
- **Missing models referenced by PRDs (verify each before adding — some may exist under a different name):** `StructuredMessage` (PRD-03 §8), `MessageTemplate` (PRD-03 §12), `VehicleCheck` (driver daily check), `ImportBatch` (PRD-01 §9), `TripPath` (downsampled replay), `AutoDebitAttempt` (PRD-05), `CctvAccessLog` (P2), `PostReaction`/`PostComment` (P2), `AnalyticsQuery` (P2).

---

## One-line summary

**The schema is done, the screens are drawn — the work is wiring (Phase 1→2), then conquering the three hard integrations one vertical at a time (GPS → notifications → money → AI), keeping a demo green at every phase boundary.**

See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) for the phased build plan.
