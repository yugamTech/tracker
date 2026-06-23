# Yaanam scripts

## `driver-sim.mjs` — driver-ping simulator (Phase 3)

Demo a moving bus without a physical device or an EAS background-GPS build. It
logs in as a driver (OTP bypass), resets + starts the trip, then POSTs batches
of interpolated location pings to `POST /tracking/ping/batch`, driving the
route's stops in order. The backend does the real work from there: dedup +
reconciliation, Socket.IO fan-out, `vehicle:{id}:latest` cache, geofencing,
ETA, speed monitoring, and not-boarded automation.

### Prerequisites

- Postgres + Redis up (`npm run docker:up`) and seeded (`npm run db:seed`).
- API running (`npm run dev:backend`).

### Usage

```bash
# Default: drive trip-today-001 at 30 km/h, reset + start + complete
npm run sim

# Faster demo, inject an over-speed alert, snappier wall-clock pacing
node scripts/driver-sim.mjs --speed 40 --sleep 250 --overspeed

# Drive a specific trip without resetting it, and loop the route twice
node scripts/driver-sim.mjs --trip <tripId> --no-reset --loops 2
```

### Options

| Flag | Default | Meaning |
|------|---------|---------|
| `--trip <id>` | `trip-today-001` | Trip to drive |
| `--phone <e164>` | `+919999000002` | Driver phone (OTP bypass) |
| `--otp <code>` | `123456` | Bypass OTP code |
| `--speed <kmh>` | `30` | Target ground speed |
| `--batch <n>` | `4` | Pings per POST (batch size) |
| `--sleep <ms>` | `1500` | Wall-clock gap between batches |
| `--step <sec>` | `3` | Synthetic seconds per ping |
| `--max-pts <n>` | `30` | Max interpolated points per segment |
| `--jitter <m>` | `8` | Random GPS noise (metres) |
| `--loops <n>` | `1` | Repeat the route N times |
| `--overspeed` | off | Inject one ~110 km/h hop (trips OVERSPEED) |
| `--no-reset` | — | Don't reset the trip first |
| `--no-start` | — | Don't auto-start the trip |
| `--no-complete` | — | Don't complete the trip at the end |
| `--base <url>` | `http://localhost:3000/api/v1` | API base URL |

Watch it live on the parent live-map, driver active-trip, or admin fleet
screen — or subscribe a Socket.IO client to the `/tracking` namespace.

> The device clock is synthesised in the **past** so timestamps ramp up to ~now
> (marching into the future would hit the backend's clock-skew clamp). Speeds
> therefore reflect `--speed`, not `--sleep`.

> `POST /trips/:id/reset` is **dev-only** (gated behind `OTP_BYPASS_MODE=true`).
