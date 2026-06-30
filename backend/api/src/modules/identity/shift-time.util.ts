/**
 * Shift time validation — a shift's pickup/drop time is a 24-hour wall-clock
 * "HH:MM" (00:00–23:59). The single regex is shared between the create/update
 * DTOs (`@Matches`) and the unit tests, so the rule the API enforces is exactly
 * the rule we test. Pure module — no Nest/Prisma dependency.
 */

/** 24-hour "HH:MM": 00:00 … 23:59. Rejects "8:00", "24:00", "12:60", "".  */
export const SHIFT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Whether `value` is a valid 24-hour "HH:MM" shift time. */
export function isValidShiftTime(value: string): boolean {
  return SHIFT_TIME_PATTERN.test(value);
}
