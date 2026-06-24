export enum ComplaintStatus {
  RECEIVED = 'RECEIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COUNSELLING_CALL = 'COUNSELLING_CALL',
  ADMIN_CALL = 'ADMIN_CALL',
  RESOLVED = 'RESOLVED',
  PARENT_RATING = 'PARENT_RATING',
  VISIT = 'VISIT',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export enum ComplaintCategory {
  BEHAVIOUR = 'BEHAVIOUR',
  SAFETY = 'SAFETY',
  TIMING = 'TIMING',
  VEHICLE_CONDITION = 'VEHICLE_CONDITION',
  ROUTE_ISSUE = 'ROUTE_ISSUE',
  OTHER = 'OTHER',
}

/** The parent's satisfaction step after a complaint is RESOLVED (1:1 with the complaint). */
export interface ResolutionRating {
  id: string;
  complaintId: string;
  /** The parent personId who submitted it — always the complaint's raiser. */
  ratedBy: string;
  rating: number; // 1–5
  /** Explicit yes/no — the close/escalate gate keys off this, not the star count. */
  satisfied: boolean;
  comment?: string;
  ts: string;
}

/** Payload the parent submits from the resolution-rating screen. */
export interface ResolutionRatingInput {
  rating: number; // 1–5
  satisfied: boolean;
  comment?: string;
}

/** A complaint's raiser, joined for the admin "who raised it" line. */
export interface ComplaintRaiser {
  id: string;
  name: string;
  phone: string;
}

export interface Complaint {
  id: string;
  tenantId: string;
  raisedBy: string;
  studentId?: string;
  tripId?: string;
  category: ComplaintCategory;
  description?: string;
  status: ComplaintStatus;
  ownerId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  slaDeadline?: string;
  createdAt: string;
  resolvedAt?: string;
  /** Joined on list/detail reads (see backend includes). */
  raiser?: ComplaintRaiser;
  resolutionRating?: ResolutionRating | null;
  events?: ComplaintEvent[];
}

export interface ComplaintEvent {
  id: string;
  complaintId: string;
  actor: string;
  /** The acting person's display name, resolved server-side from `actor`. */
  actorName?: string;
  fromStatus: ComplaintStatus;
  toStatus: ComplaintStatus;
  note?: string;
  ts: string;
}

/**
 * The complaint status lifecycle. A transition is legal only if `to` appears in
 * `COMPLAINT_TRANSITIONS[from]`. Both the backend (validation) and the admin UI
 * (which next-status buttons to show) read this single map so they never drift.
 *
 *  raise → RECEIVED → (investigation) → RESOLVED → parent rates:
 *    satisfied     → PARENT_RATING → CLOSED
 *    not satisfied → REOPENED      → (re-work) → RESOLVED … or CLOSED (override)
 *
 * RESOLVED→PARENT_RATING and RESOLVED→REOPENED are driven by the parent's rating;
 * CLOSED is terminal.
 */
export const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.RECEIVED]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.COUNSELLING_CALL,
    ComplaintStatus.ADMIN_CALL,
    ComplaintStatus.VISIT,
    ComplaintStatus.RESOLVED,
  ],
  [ComplaintStatus.IN_PROGRESS]: [
    ComplaintStatus.COUNSELLING_CALL,
    ComplaintStatus.ADMIN_CALL,
    ComplaintStatus.VISIT,
    ComplaintStatus.RESOLVED,
  ],
  [ComplaintStatus.COUNSELLING_CALL]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.ADMIN_CALL,
    ComplaintStatus.VISIT,
    ComplaintStatus.RESOLVED,
  ],
  [ComplaintStatus.ADMIN_CALL]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.COUNSELLING_CALL,
    ComplaintStatus.VISIT,
    ComplaintStatus.RESOLVED,
  ],
  [ComplaintStatus.VISIT]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.COUNSELLING_CALL,
    ComplaintStatus.ADMIN_CALL,
    ComplaintStatus.RESOLVED,
  ],
  [ComplaintStatus.RESOLVED]: [
    ComplaintStatus.PARENT_RATING,
    ComplaintStatus.REOPENED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.PARENT_RATING]: [
    ComplaintStatus.CLOSED,
    ComplaintStatus.REOPENED,
    ComplaintStatus.IN_PROGRESS,
  ],
  [ComplaintStatus.REOPENED]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.COUNSELLING_CALL,
    ComplaintStatus.ADMIN_CALL,
    ComplaintStatus.VISIT,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.CLOSED]: [],
};

/** True if `from → to` is a legal complaint status transition. */
export function canTransitionComplaint(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return COMPLAINT_TRANSITIONS[from]?.includes(to) ?? false;
}
