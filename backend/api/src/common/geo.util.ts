/**
 * Geospatial helpers shared across tracking, geofencing, speed and ETA.
 * Pure functions — no I/O — so they're trivially unit-testable.
 */

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Speed in km/h given a distance (m) and a time delta (ms). Guards div-by-zero. */
export function speedKmh(distanceMeters: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  const metersPerSec = distanceMeters / (deltaMs / 1000);
  return metersPerSec * 3.6;
}
