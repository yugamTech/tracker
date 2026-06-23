#!/usr/bin/env node
/**
 * Yaanam driver-ping simulator (Phase 3).
 *
 * Logs in as a driver via OTP bypass, optionally resets the trip, starts it,
 * then "drives" the route by POSTing batches of interpolated location pings to
 * POST /tracking/ping/batch — so you can demo a moving bus on the parent/admin
 * maps without a physical device or an EAS background-GPS build.
 *
 * Usage:
 *   node scripts/driver-sim.mjs [options]
 *
 * Options (all optional):
 *   --trip <id>        Trip to drive            (default: trip-today-001)
 *   --phone <e164>     Driver phone             (default: +919999000002)
 *   --otp <code>       Bypass OTP               (default: 123456)
 *   --speed <kmh>      Target ground speed      (default: 30)
 *   --batch <n>        Pings per POST           (default: 4)
 *   --sleep <ms>       Wall-clock gap per batch (default: 1500)
 *   --step <sec>       Synthetic seconds/ping   (default: 3)
 *   --max-pts <n>      Max points per segment   (default: 30)
 *   --jitter <m>       Random GPS noise, metres (default: 8)
 *   --loops <n>        Repeat the route n times (default: 1)
 *   --overspeed        Inject one fast hop to trip the over-speed alert
 *   --no-reset         Don't reset the trip first
 *   --no-start         Don't auto-start the trip
 *   --no-complete      Don't complete the trip at the end
 *   --base <url>       API base (default: http://localhost:3000/api/v1)
 */

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const BASE = opt('base', 'http://localhost:3000/api/v1');
const TRIP = opt('trip', 'trip-today-001');
const PHONE = opt('phone', '+919999000002');
const OTP = opt('otp', '123456');
const SPEED_KMH = Number(opt('speed', '30'));
const BATCH = Number(opt('batch', '4'));
const SLEEP_MS = Number(opt('sleep', '1500'));
const STEP_SEC = Number(opt('step', '3'));
const MAX_PTS = Number(opt('max-pts', '30'));
const JITTER_M = Number(opt('jitter', '8'));
const LOOPS = Number(opt('loops', '1'));
const OVERSPEED = flag('overspeed');
const DO_RESET = !flag('no-reset');
const DO_START = !flag('no-start');
const DO_COMPLETE = !flag('no-complete');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
// ~metres -> degrees (rough, fine for jitter)
const jitter = () => (JITTER_M ? (Math.random() - 0.5) * 2 * (JITTER_M / 111000) : 0);

let token;
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? res.statusText;
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(msg)}`);
  }
  return json.data;
}

async function login() {
  await api('POST', '/auth/otp/request', { phone: PHONE });
  const data = await api('POST', '/auth/otp/verify', { phone: PHONE, otp: OTP });
  token = data.accessToken;
  console.log(`🔑 logged in as ${PHONE}`);
}

function buildPath(stops) {
  // Interpolate between consecutive stops. Each point carries the synthetic
  // time (dt) to reach it so the configured speed holds regardless of how many
  // points a (possibly very long) segment is capped to.
  const speedMps = Math.max(1, (SPEED_KMH * 1000) / 3600);
  const idealStep = speedMps * STEP_SEC;
  const path = [{ lat: stops[0].lat, lng: stops[0].lng, dt: 0 }];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const dist = haversine(a, b);
    const n = Math.min(MAX_PTS, Math.max(1, Math.ceil(dist / idealStep)));
    const dt = dist / n / speedMps; // seconds to traverse each sub-step
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      path.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, dt });
    }
  }
  return path;
}

async function main() {
  console.log(`🚌 Yaanam driver-sim — trip ${TRIP} @ ${SPEED_KMH} km/h`);
  await login();

  if (DO_RESET) {
    await api('POST', `/trips/${TRIP}/reset`);
    console.log('♻️  trip reset to SCHEDULED');
  }
  if (DO_START) {
    try {
      await api('POST', `/trips/${TRIP}/start`);
      console.log('▶️  trip started');
    } catch (e) {
      console.log(`▶️  start skipped (${e.message})`);
    }
  }

  const trip = await api('GET', `/trips/${TRIP}`);
  const stops = (trip.route?.stops ?? [])
    .sort((a, b) => a.sequence - b.sequence)
    .map((rs) => ({ lat: rs.stop.lat, lng: rs.stop.lng, name: rs.stop.name }));
  if (stops.length < 2) throw new Error('trip route needs >= 2 stops to drive');
  console.log(`🗺️  route: ${stops.map((s) => s.name).join(' → ')}`);

  // Build the path up front and start the synthetic device clock that far in
  // the PAST, so timestamps ramp up to ~now. (If we marched into the future the
  // backend's clock-skew reconciliation would clamp them all to server-now and
  // collapse every speed calculation.)
  const path = buildPath(stops);
  const loopSeconds = path.reduce((s, p) => s + (p.dt || STEP_SEC), 0) + (OVERSPEED ? 10 : 0);
  let seq = Math.floor(Date.now() / 1000);
  let clock = Date.now() - loopSeconds * LOOPS * 1000 - 2000;
  let buffer = [];
  let prev = null; // last emitted point, for the over-speed injection

  const emit = (lat, lng, dtSec) => {
    clock += Math.max(0.5, dtSec) * 1000;
    buffer.push({
      tripId: TRIP,
      lat: lat + jitter(),
      lng: lng + jitter(),
      accuracy: 5 + Math.random() * 5,
      speed: SPEED_KMH / 3.6,
      deviceTs: new Date(clock).toISOString(),
      sequence: seq++,
    });
    prev = { lat, lng };
  };

  const flush = async () => {
    if (!buffer.length) return;
    const pings = buffer;
    buffer = [];
    const res = await api('POST', '/tracking/ping/batch', { pings });
    const last = pings[pings.length - 1];
    console.log(
      `📡 batch x${pings.length} | last ${last.lat.toFixed(4)},${last.lng.toFixed(4)} ` +
        `| accepted=${res.accepted} dup=${res.duplicates}`,
    );
  };

  const hopIndex = Math.floor(path.length / 2);
  for (let loop = 0; loop < LOOPS; loop++) {
    if (LOOPS > 1) console.log(`🔁 loop ${loop + 1}/${LOOPS}`);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      // Optional one-off over-speed hop: 305 m in 10 s synthetic time ~= 110
      // km/h — above the 60 threshold, below the 200 km/h teleport filter.
      if (OVERSPEED && i === hopIndex && prev) {
        emit(prev.lat + 305 / 111000, prev.lng, 10);
      }
      emit(p.lat, p.lng, p.dt || STEP_SEC);
      if (buffer.length >= BATCH) {
        await flush();
        await sleep(SLEEP_MS);
      }
    }
    await flush();
  }

  if (DO_COMPLETE) {
    await api('POST', `/trips/${TRIP}/complete`);
    console.log('🏁 trip completed');
  }
  console.log('✅ done');
}

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(1);
  stopping = true;
  console.log('\n⏹️  stopping (Ctrl+C again to force)…');
  process.exit(0);
});

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
