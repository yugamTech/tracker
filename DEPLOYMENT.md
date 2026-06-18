# Deployment Guide

How to take Yaanam from this repo to a live demo/early-production environment.
Work top to bottom — each step's output feeds the next.

## Architecture

| Layer | What runs | Suggested host | Free tier |
|---|---|---|---|
| Backend API (NestJS + Socket.IO) | `backend/api` | Railway / Render / Fly | yes (~$0–5/mo) |
| PostgreSQL | Prisma schema | Supabase / Neon / Railway PG | yes (500MB) |
| Redis (sockets + cache) | — | Upstash | yes (10k cmd/day) |
| Mobile apps (admin/parent/driver) | `apps/*` | Expo EAS Build | yes (30 builds/mo) |
| DNS + TLS + CDN | — | Cloudflare | yes |

> The backend **requires** PostgreSQL (via Prisma) and Redis. There is no
> MongoDB in this stack.

---

## 1. Provision data stores

**PostgreSQL** — create a database (Supabase/Neon/Railway) and copy its
connection string. It becomes `DATABASE_URL`.

**Redis** — create an Upstash Redis database. Copy host, port, password into
`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.

---

## 2. Deploy the backend

The repo ships a monorepo-aware `backend/api/Dockerfile`. **Build context must
be the repository root** (workspaces resolve from there).

### Railway / Render (Docker)
1. New service → Deploy from GitHub repo.
2. Set Dockerfile path: `backend/api/Dockerfile`, root directory: repo root.
3. Add the env vars below.
4. Deploy. The container runs `prisma migrate deploy` on boot, then starts.

### Required env vars (production)
The API **refuses to boot** if these are missing or left at dev defaults
(see `backend/api/src/config/env.validation.ts`):

```
NODE_ENV=production
DATABASE_URL=postgresql://...          # from step 1
JWT_SECRET=<long random string>        # generate: openssl rand -base64 48
OTP_BYPASS_MODE=false                  # MUST be false in production
REDIS_HOST=...                         # from step 1
REDIS_PORT=...
REDIS_PASSWORD=...
ALLOWED_ORIGINS=https://app.yourdomain.com
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

> For a **demo** where you want OTP bypass (code `123456`), set
> `NODE_ENV=development` so validation allows `OTP_BYPASS_MODE=true`. Never do
> this for real users.

### Health check
After deploy, hit `https://<your-api>/api/v1` — you should get a JSON response.

---

## 3. Seed demo data

Once the database is reachable, seed the three demo schools:

```bash
DATABASE_URL="postgresql://..." npm run db:seed --workspace=backend/api
```

Creates **Yugam School 1/2/3**, each with its own admin/driver/parent, route,
stops, vehicle, students and a trip for today. Login phones (OTP `123456`):

| | Admin | Driver | Parent |
|---|---|---|---|
| School 1 | +919900000001 | +919900000011 | +919900000021 |
| School 2 | +919900000002 | +919900000012 | +919900000022 |
| School 3 | +919900000003 | +919900000013 | +919900000023 |

---

## 4. Point the apps at the backend

Each app reads `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`. For store/internal
builds these live in `apps/<app>/eas.json` under the `staging`/`production`
profiles — replace the `saarthi.app` placeholders with your real API URL.

---

## 5. Build the apps (EAS)

```bash
npm install -g eas-cli
eas login

# From each app dir (apps/admin-app, apps/parent-app, apps/driver-app):
eas init                 # creates a real EAS projectId (replaces the placeholder)
eas build --profile development --platform android   # installable APK for demo
# or --profile production --platform all  for store builds
```

> The maps (MapLibre) only render in a **dev/EAS build**, not Expo Go. The app
> degrades gracefully in Expo Go (map shows a "Map available in dev build"
> placeholder), so everything else is testable there.

---

## 6. Cloudflare (optional but recommended)
- Add your domain, point a subdomain (e.g. `api.yourdomain.com`) at the backend host.
- Enable proxy (orange cloud) for free TLS + DDoS protection.
- Add `https://api.yourdomain.com` to `ALLOWED_ORIGINS`.

---

## Pre-flight checklist

- [ ] `npm run typecheck` passes (all workspaces)
- [ ] `npm run build --workspace=backend/api` succeeds
- [ ] `DATABASE_URL`, `JWT_SECRET`, Redis vars set on the host
- [ ] `OTP_BYPASS_MODE=false` for real users (or `NODE_ENV=development` for demo)
- [ ] `ALLOWED_ORIGINS` includes the app/web origins
- [ ] `eas.json` URLs point at the deployed API
- [ ] Seed run against the production DB
