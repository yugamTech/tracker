# Pre-APK / Pre-IPA Production Checklist

Hardening pass for **real EAS builds** (compiled APK/IPA / dev-client) of the three
Expo apps — `admin-app`, `parent-app`, `driver-app`. This is **not** Expo Go: native
modules are actually linked, JS is minified, `__DEV__` is `false`, there is no red-box
overlay, and a render crash white-screens the app unless caught.

Use this document to (a) understand what was changed in this pass and (b) verify the
build on a device before shipping. Items are grouped by the audit area, then a flat
**"verify after building"** list at the end.

---

## 0. How to build (APK vs AAB)

All three apps share an identical [`eas.json`](apps/driver-app/eas.json) with three profiles:

| Profile | `distribution` | Android artifact | API/Socket host |
|---|---|---|---|
| `development` | `internal` | APK (dev client) | **none set → falls back to `http://localhost:3000`** |
| `staging` | `internal` | **APK** | `https://api-staging.saarthi.app` |
| `production` | `store` | **AAB (app bundle)** | `https://api.saarthi.app` |

- `eas build -p android --profile production` produces an **`.aab`** (for Play Store),
  **not** an installable `.apk`. To sideload a production-config APK for QA, either:
  - build the `staging` profile (internal → APK, staging API), **or**
  - add `"android": { "buildType": "apk" }` to the `production` profile.
- `production` is correct **as-is for a Play Store submission**. Confirm which artifact
  you actually need before building.
- iOS: `production` uses `distribution: store` → App Store `.ipa`. `staging` →
  ad-hoc/internal `.ipa` (needs devices registered on the Apple account).

> There is no `cli.appVersionSource` / `autoIncrement` configured. `version` (1.0.0) and
> the native build number are managed manually in each `app.json` — bump them per release.

---

## 1. Native modules

### MapLibre (`@maplibre/maplibre-react-native@^11`) — live maps
- Used only via [`packages/ui/.../LiveBusMap.tsx`](packages/ui/src/components/LiveBusMap.tsx).
  Importers: parent `track/[tripId]`, admin `fleet/index` + `fleet/[tripId]`.
- **Graceful fallback present**: `LiveBusMap` `require()`s the native module in a
  `try/catch`; if absent it renders a "Map available in dev build" placeholder, so it
  never crashes Expo Go. In a real build the module **is** linked and the map renders.
- Config plugin `@maplibre/maplibre-react-native` is declared in **parent** and **admin**
  `app.json`. **Driver app does not use maps** and correctly omits both the dep and the
  plugin. ✅
- Tiles come from public OSM (`tile.openstreetmap.org`) over HTTPS — **no API key/token**.
- ⚠️ Verify in the build: the map actually draws tiles (network), markers appear, and the
  bus marker tweens. OSM's tile server has a usage policy; for production volume consider
  a dedicated tile provider.

### expo-camera — boarding photos (driver only)
- Used only in [`driver .../attendance/photo.tsx`](apps/driver-app/app/(app)/trip/attendance/photo.tsx).
- **Robust**: requests permission via `useCameraPermissions`, shows a permission-denied
  screen with a **"Board without photo"** fallback, and wraps `takePictureAsync` /
  upload in `try/catch` with a toast. ✅
- Permissions declared: Android `CAMERA` in `app.json`; iOS `NSCameraUsageDescription`
  via the `expo-camera` plugin string. ✅
- ⚠️ Verify in the build: deny the permission → fallback works; allow → capture + upload
  works. `base64: true` at `quality: 0.6` keeps payloads reasonable.

### Location — ✅ REAL GPS (foreground + background)
- The driver's live position now comes from the device. A location service
  ([`driver/services/location.ts`](apps/driver-app/services/location.ts)) feeds each real
  fix from `expo-location` into the same `driver:ping` socket payload the gateway already
  validates — the haversine/interpolation simulation in
  [`driver .../trip/[tripId]/active.tsx`](apps/driver-app/app/(app)/trip/[tripId]/active.tsx)
  is gone. Cadence (~3s / ~15 m) matches the old loop so backend speed/ETA/geofence behave
  the same.
- **Background**: an `expo-task-manager` task (`saarthi-driver-location`) is started via
  `startLocationUpdatesAsync` when a trip goes live and stopped on complete/cancel/unmount,
  so pings continue when the phone locks mid-trip. The task is registered at app startup
  (side-effect import in the root layout) and no-ops when there's no active trip, so it
  can't leak across trips.
- **Permissions**: foreground location is now a **hard gate to START a trip** — the start
  flow calls `ensureForegroundPermission()` (in `services/location.ts`) before
  `startTrip.mutate`, and **blocks** the start if it's denied, with a recoverable prompt
  (re-request in-app, or open Settings when the OS won't ask again). This closes the
  attendance-integrity hole: no location permission → no trip → no attendance. The sensitive
  "Always"/background permission is still requested **only when a trip is active**, and
  foreground-only still works if background is denied. Once a trip has legitimately started,
  a momentary GPS drop (cold start / tunnel / signal loss) does **not** strand the driver —
  marking stays available (banner while waiting; explicit "Mark without GPS" override for a
  long outage). If the native module is missing (Expo Go without a dev build), the start is
  **not** blocked and it degrades gracefully — no GPS, no crash — exactly like the
  MapLibre/camera fallbacks; in a real build the module is always present, so the permission
  decision is the only gate.
- `app.json` is right-sized to what's actually used: Android
  `ACCESS_FINE/COARSE/BACKGROUND_LOCATION` + `FOREGROUND_SERVICE[_LOCATION]`; iOS
  `NSLocationWhenInUse…` + `NSLocationAlwaysAndWhenInUse…` and `UIBackgroundModes: [location]`
  (dropped the unused legacy `NSLocationAlwaysUsageDescription` and the unused `fetch`
  background mode).
  - 🚩 **Play Store**: `ACCESS_BACKGROUND_LOCATION` is now genuinely used, so it still needs
    the prominent-disclosure flow + a privacy-policy entry, but it is no longer declared for
    a dead feature. Background GPS must be tested on a dev/EAS build (not Expo Go).

### Notifications — ⚠️ DEV STUB (no native push yet)
- **`expo-notifications` is not a dependency of any app.** The in-app "Notifications"
  screens are plain REST lists.
- All three `(app)/_layout.tsx` call `useRegisterDeviceToken` with a **fake token**
  (`dev-token-<personId>`) — there is no `getExpoPushTokenAsync`, no
  `setNotificationHandler`, no listeners. So push notifications do **not** function in a
  build, but nothing crashes.
- To enable real push later: add `expo-notifications`, request `POST_NOTIFICATIONS`
  (Android 13+), fetch the real Expo/FCM/APNs token, and configure the credential.

### Other native deps in use
- `expo-secure-store` — token storage in api-client. ✅ (plugin declared in all three.)
- admin: `expo-document-picker`, `expo-file-system`, `expo-sharing` — bulk import/export.
  Verify file pick + share work in the build.
- All apps: `react-native-reanimated` (+ admin `react-native-gesture-handler`,
  `react-native-worklets`). Confirm the Reanimated Babel plugin is present (see each
  `babel.config.js`) or animations break **only in release**.

---

## 2. Environment variables

**All `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time** by Metro — they
are **baked, not runtime-configurable**. Changing the API host means a **rebuild**, not a
config flip. `api-client` is consumed as TypeScript source (`"main": "src/index.ts"`), so
its `process.env.EXPO_PUBLIC_*` reads are inlined with the *app's* build-time env too.

| Var | Read where | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | [`axios.ts`](packages/api-client/src/axios.ts) (`+ '/api/v1'`), [`socket.hooks.ts`](packages/api-client/src/socket/socket.hooks.ts) | **The one that matters.** Bare host; `/api/v1` is appended for REST, `/tracking` for the socket namespace. |
| `EXPO_PUBLIC_SOCKET_URL` | `socket.hooks.ts` (now wired) | **Was defined in every `eas.json` but never read.** Now used with fallback to `EXPO_PUBLIC_API_URL`. Optional. |
| `EXPO_PUBLIC_ENV` | (not read in code) | Build-identification only; harmless. |

### Flags / gotchas
- **`localhost` fallback baked into a build = total failure.** If `EXPO_PUBLIC_API_URL`
  is unset at build time, both axios and the socket fall back to `http://localhost:3000`,
  which on a device means *the device itself*. `staging`/`production` set it correctly;
  the **`development` profile does not** (intended for a dev client + LAN/tunnel).
- **Android cleartext**: the `http://localhost:3000` (and the `http://192.168.x.x` LAN
  example in `.env.example`) is cleartext. Release Android blocks cleartext HTTP by
  default. Prod uses `https://` so it's fine; just don't ship a build pointed at an
  `http://` host.
- `packages/api-client/dist/` exists locally with a **stale, different** base URL (no
  `/api/v1`). It is **gitignored and not bundled** (apps use `src/`), so it's harmless —
  but delete it if it confuses anyone.

---

## 3. Error boundaries (added this pass)

- New [`ErrorBoundary`](packages/ui/src/components/ErrorBoundary.tsx) in `@yaanam/ui`
  (a class component — the only thing that can catch render errors).
- It is now the **outermost wrapper** in every app's root layout
  ([driver](apps/driver-app/app/_layout.tsx), [parent](apps/parent-app/app/_layout.tsx),
  [admin](apps/admin-app/app/_layout.tsx)), outside the providers, so a crash in any
  screen/provider shows a recovery screen ("Something went wrong" + **Try again**) instead
  of a white screen.
- The fallback uses only RN primitives + theme tokens, so it can't itself depend on a
  context that just crashed. Crash details print to device logs (`console.error`) and in
  `__DEV__` show on screen. `onError` prop is ready to wire to a crash reporter (Sentry).
- ⚠️ Verify in the build: there is **no crash reporter** installed. Consider adding
  `sentry-expo` (or similar) and passing it via `onError` so production crashes are
  actually reported.

---

## 4. Network resilience (api-client)

Audited [`axios.ts`](packages/api-client/src/axios.ts),
[`query-client.ts`](packages/api-client/src/query-client.ts),
[`socket.hooks.ts`](packages/api-client/src/socket/socket.hooks.ts).

**Already in place (verified):**
- Axios `timeout: 10_000` (10 s) on every request.
- React Query: `retry: 2` for queries, `retry: 0` for mutations, `refetchOnWindowFocus: false`.
- Access token attached on every request from SecureStore; 401 → silent refresh → retry.

**Fixed this pass:**
- 🐞 **Refresh loop**: a 401 on `/auth/refresh` *itself* used to re-enter the refresh
  branch and recurse forever (hammering the server). Now a 401 on the refresh endpoint
  tears the session down once instead of retrying.
- 🐞 **401 never reached login**: the interceptor cleared SecureStore tokens but never
  updated app state, so a dead session left the user staring at failing screens. Added
  `setUnauthorizedHandler` in api-client; each app's auth store registers
  `() => logout()`, and each `(app)/_layout` now declaratively `<Redirect>`s to
  `/(auth)/phone` when `isAuthenticated` is false. So an unrecoverable 401 → login. ✅

**Known gaps (not changed — would add a native dep):**
- **No offline detection.** React Query's `onlineManager` is not wired to NetInfo
  (`@react-native-community/netinfo` is not installed), so requests fire and fail/retry
  when offline rather than pausing. To improve, install NetInfo and configure
  `onlineManager`. Today the UX is: error states + the 10 s timeout.
- The session lives in an **in-memory Zustand store** (not persisted). A cold start always
  returns to the login screen even though tokens are in SecureStore — this is existing
  behaviour, called out so QA doesn't file it as a regression.
- ⚠️ Verify in the build: kill the network mid-use → screens show error/empty states (no
  crash). Let an access token expire → silent refresh happens. Revoke the refresh token →
  app drops to the login screen instead of looping.

---

## 5. Crash-safety (undefined / null data)

The screen code is **already defensively written** — consistent optional chaining,
`?? []` defaults on query results, and explicit `isLoading` / `isError` / empty gates
(e.g. admin `trips/index`, `fleet/[tripId]`; parent `track/[tripId]`). No blanket changes
were made (they'd be churn).

**Fixed the genuinely-unguarded numeric spots** (would throw if coords are null):
- [`admin routes/[routeId].tsx`](apps/admin-app/app/(app)/routes/[routeId].tsx) — guarded
  `rs.stop.lat.toFixed()` / `lng.toFixed()` behind a null check.
- [`admin fleet/index.tsx`](apps/admin-app/app/(app)/fleet/index.tsx) — removed a
  `b.lng!` non-null assertion; now checks both `lat` and `lng`.

The new **ErrorBoundary (§3) is the real net** for anything missed — a stray undefined
access shows the recovery screen, not a white screen.

---

## 6. eas.json review — see §0

Production profile is correct for store submission. Decide APK vs AAB per §0. Confirm the
EAS `projectId`s in each `app.json` (`saarthi-driver/parent/admin`) match the real EAS
project slugs on your Expo account before the first build, or `eas build` will prompt to
create/link them.

---

## ✅ Verify-after-building (device smoke test)

Run on a **real compiled build**, on **both** a fresh install and an upgrade, **Android +
iOS**:

**Boot & crash-net**
- [ ] App launches past the splash to the login screen (no white screen).
- [ ] Force a thrown error in a screen → the **"Something went wrong / Try again"**
      recovery screen appears (not a white screen); Try again recovers.

**Auth & network**
- [ ] OTP login works against the **baked** API host (check it's staging/prod, not localhost).
- [ ] Pull the network → screens show error/empty states, app stays alive.
- [ ] Token refresh: after the access token expires, requests keep working silently.
- [ ] Hard 401 (revoked refresh token) → app redirects to login, no request storm.
- [ ] Realtime socket connects (driver broadcasts; parent/admin see the live bus move).

**Driver app**
- [ ] Camera permission denied → "Board without photo" path works; allowed → capture +
      upload works.
- [ ] Start trip **with location denied** → start is **blocked** with the "Location access
      required" prompt; no trip starts and nothing broadcasts. "Allow location" re-requests;
      if set to "Don't ask again", the button becomes **Open Settings** (no dead-end).
- [ ] Grant location → start trip → real device position broadcasts on `driver:ping`; the
      bus moves on the parent/admin map as the phone moves. "Navigate" opens Google Maps.
      (Test on a dev/EAS build — background GPS doesn't run in Expo Go.)
- [ ] Lock the phone mid-trip → pings keep flowing (foreground-service notification shows);
      complete the trip → background updates stop.
- [ ] Mid-trip GPS drop (tunnel / airplane mode briefly) → trip stays live, **"Waiting for
      GPS…"** banner shows, driver is **not** stranded; attendance markable on arrival, and a
      genuine long outage offers the **"Mark without GPS — no signal"** confirm.
- [ ] Reach a stop with GPS healthy → "Mark attendance" unlocks; before arrival it stays
      disabled ("Reach the stop to mark attendance") with **no** "Mark without GPS" button
      (the override only appears when GPS can't confirm arrival).

**Parent app**
- [ ] Live tracking map renders OSM tiles + bus/stop markers; ETA + arrival banners show.
- [ ] Map fallback never shows in a real build (it means the native module didn't link).

**Admin app**
- [ ] Live Fleet map renders; trip monitor, roster, routes (coords show or "No coordinates").
- [ ] Bulk import: document pick + file read + share work.
- [ ] Drawer navigation + gestures work (GestureHandlerRootView present).

**Permissions / store**
- [ ] iOS: camera (driver) + the when-in-use and "Always" location prompts show the
      declared usage strings.
- [ ] Android: `ACCESS_BACKGROUND_LOCATION` prominent-disclosure flow + privacy policy ready
      for Play submission (§1 Location — it's now genuinely used).
- [ ] App version / build number bumped for this release.

**Production hardening (recommended, not yet done)**
- [ ] Install a crash reporter (e.g. `sentry-expo`) and wire it to `ErrorBoundary.onError`.
- [ ] Wire NetInfo → React Query `onlineManager` for offline-aware queries.
- [ ] Implement `expo-notifications` push, or remove the unused dep. (Real `expo-location`
      GPS for the driver is now wired — §1 Location.)
