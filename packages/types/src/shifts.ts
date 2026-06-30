/**
 * Shifts — the school-shift a student rides on. Backed by the AgeGroup model
 * (id, name, pickup/drop time, optionally pinned to a route) and surfaced in the
 * admin app as "Shifts". Times are 24-hour "HH:MM".
 */
export interface Shift {
  id: string;
  tenantId: string;
  name: string;
  pickupTime: string;
  dropTime: string;
  routeId?: string | null;
  /** Number of students assigned to this shift (list payload only). */
  _count?: { students: number };
}

/** Create payload for a shift — pickup/drop are 24-hour "HH:MM". */
export interface CreateShiftInput {
  name: string;
  pickupTime: string;
  dropTime: string;
  routeId?: string;
}

/** Patch payload for a shift — only the supplied fields change. */
export type UpdateShiftInput = Partial<CreateShiftInput>;
