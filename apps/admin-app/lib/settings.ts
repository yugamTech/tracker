/**
 * Static config for the admin Settings screens — the catalog of toggleable
 * features, plus the timezone / locale / branding option lists. The per-tenant
 * *state* lives on the Tenant row (featureFlags / brandingConfig JSON) and is
 * edited through PATCH /tenants/me; this file only describes the choices.
 */

import type { FeatureFlagState } from '@yaanam/api-client';

export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
}

/**
 * Non-core features that a school can turn on/off (or flag work-in-progress).
 * These are advisory today — the apps read the resolved state to show/hide the
 * feature; the backend does not yet hard-gate on them.
 */
export const FEATURE_FLAGS: FeatureFlagDef[] = [
  { key: 'liveMap', label: 'Live GPS map', description: 'Real-time bus positions on a map for admins and parents.' },
  { key: 'rideRatings', label: 'Ride ratings', description: 'Let parents rate individual trips (per-student stars).' },
  { key: 'resolutionRatings', label: 'Complaint satisfaction', description: 'Ask parents to rate a resolution before a complaint is closed.' },
  { key: 'emergencyDirectory', label: 'Emergency directory', description: 'Live "who’s aboard" roster per route for emergencies.' },
  { key: 'bulkImport', label: 'Bulk Excel import', description: 'Onboard students, staff and routes from spreadsheets.' },
  { key: 'autopay', label: 'Autopay mandates', description: 'UPI / e-NACH recurring fee collection.' },
  { key: 'driverKyc', label: 'Driver KYC profiles', description: 'License, Aadhaar and police-verification records for drivers.' },
];

/** Absent flags default to ON — a tenant that never configured them keeps today's behaviour. */
export function resolveFlag(
  flags: Record<string, FeatureFlagState> | undefined,
  key: string,
): FeatureFlagState {
  return flags?.[key] ?? 'on';
}

/** Common timezones for the target region; the app is India-first. */
export const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dubai',
  'UTC',
];

export const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
];

/** Preset brand colours (hex). The first is the app's default indigo. */
export const BRAND_COLOR_PRESETS = [
  '#4F46E5', // indigo (default)
  '#0284C7', // sky
  '#0D9488', // teal
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#7C3AED', // violet
  '#DB2777', // pink
];

/** "HH:MM" 24-hour validity check used by the Bell Timings editor. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

/** A loose phone check — at least 7 digits, allows +, spaces, dashes. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 7 && /^[+\d][\d\s-]*$/.test(value.trim());
}

/** Client-side id for a new bell/alert row (server persists it verbatim). */
export function newRowId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
