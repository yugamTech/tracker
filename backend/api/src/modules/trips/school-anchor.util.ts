import { Direction } from '@yaanam/types';

/**
 * Where the school end sits in a trip's geometry. A PICKUP runs stops → school,
 * so the school is the DESTINATION (after the last stop). A DROP runs school →
 * stops, so the school is the ORIGIN (before the first stop).
 */
export type AnchorRole = 'ORIGIN' | 'DESTINATION';

/** The resolved "school end" of a trip, ready to graft onto the route geometry. */
export interface ResolvedAnchor {
  lat: number;
  lng: number;
  /** Display label (the trip override's label, else the tenant's school name), or null. */
  label: string | null;
  /** ORIGIN for a DROP, DESTINATION for a PICKUP. */
  role: AnchorRole;
}

/** The trip fields needed to resolve its school end (a per-trip override + direction). */
export interface AnchorTripInput {
  direction: Direction | 'PICKUP' | 'DROP';
  anchorLat?: number | null;
  anchorLng?: number | null;
  anchorLabel?: string | null;
}

/** The tenant fields used as the school-end fallback when a trip has no override. */
export interface AnchorTenantInput {
  schoolLat?: number | null;
  schoolLng?: number | null;
  schoolName?: string | null;
}

/** A coordinate is usable only when BOTH lat and lng are present numbers. */
function hasCoords(lat?: number | null, lng?: number | null): boolean {
  return typeof lat === 'number' && typeof lng === 'number';
}

/**
 * Resolve a trip's "school end".
 *
 * Precedence: the trip's own anchor override (anchorLat/Lng) wins when set, else
 * the tenant's school coordinates (schoolLat/Lng) are used. If neither exists the
 * anchor is simply absent (returns null) — callers omit it gracefully and the UI
 * nudges the admin to set school coordinates rather than the trip crashing.
 *
 * The anchor's `role` is derived from the trip direction: it's the DESTINATION of
 * a PICKUP (after the last stop) and the ORIGIN of a DROP (before the first stop).
 */
export function resolveSchoolAnchor(
  trip: AnchorTripInput,
  tenant: AnchorTenantInput | null | undefined,
): ResolvedAnchor | null {
  const role: AnchorRole = trip.direction === Direction.PICKUP ? 'DESTINATION' : 'ORIGIN';

  // 1) Per-trip override (a "different destination" run). Both coords required.
  if (hasCoords(trip.anchorLat, trip.anchorLng)) {
    return { lat: trip.anchorLat as number, lng: trip.anchorLng as number, label: trip.anchorLabel ?? null, role };
  }

  // 2) Tenant school coordinates (the default school end for every trip).
  if (tenant && hasCoords(tenant.schoolLat, tenant.schoolLng)) {
    return { lat: tenant.schoolLat as number, lng: tenant.schoolLng as number, label: tenant.schoolName ?? null, role };
  }

  // 3) Neither set — no anchor (UI surfaces a settings nudge instead).
  return null;
}
