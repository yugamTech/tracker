/**
 * Unit tests for `canTransitionComplaint` — the single-source-of-truth
 * lifecycle guard shared between ComplaintsService (validation) and the admin
 * UI (which next-status buttons to show).
 *
 * Pure function; no mocking required.
 */
import { canTransitionComplaint, ComplaintStatus } from '@yaanam/types';

const {
  RECEIVED,
  IN_PROGRESS,
  COUNSELLING_CALL,
  ADMIN_CALL,
  VISIT,
  RESOLVED,
  PARENT_RATING,
  REOPENED,
  CLOSED,
} = ComplaintStatus;

describe('canTransitionComplaint', () => {
  // ── Valid transitions ────────────────────────────────────────────────────

  describe('valid transitions → true', () => {
    it.each([
      // Investigation flow
      [RECEIVED, IN_PROGRESS],
      [RECEIVED, COUNSELLING_CALL],
      [RECEIVED, ADMIN_CALL],
      [RECEIVED, VISIT],
      [RECEIVED, RESOLVED],
      [IN_PROGRESS, COUNSELLING_CALL],
      [IN_PROGRESS, ADMIN_CALL],
      [IN_PROGRESS, VISIT],
      [IN_PROGRESS, RESOLVED],
      [COUNSELLING_CALL, IN_PROGRESS],
      [COUNSELLING_CALL, RESOLVED],
      [ADMIN_CALL, RESOLVED],
      [VISIT, RESOLVED],
      // Post-resolution
      [RESOLVED, PARENT_RATING],
      [RESOLVED, REOPENED],
      [RESOLVED, IN_PROGRESS],
      [RESOLVED, CLOSED],
      // Parent rates → close or escalate
      [PARENT_RATING, CLOSED],
      [PARENT_RATING, REOPENED],
      [PARENT_RATING, IN_PROGRESS],
      // Re-opened re-work path
      [REOPENED, IN_PROGRESS],
      [REOPENED, COUNSELLING_CALL],
      [REOPENED, ADMIN_CALL],
      [REOPENED, VISIT],
      [REOPENED, RESOLVED],
      [REOPENED, CLOSED],
    ])('%s → %s', (from, to) => {
      expect(canTransitionComplaint(from, to)).toBe(true);
    });
  });

  // ── Illegal transitions ──────────────────────────────────────────────────

  describe('illegal transitions → false', () => {
    it.each([
      // CLOSED is terminal — nothing can leave it
      [CLOSED, RECEIVED],
      [CLOSED, IN_PROGRESS],
      [CLOSED, RESOLVED],
      [CLOSED, REOPENED],
      [CLOSED, CLOSED],
      // Cannot skip the investigation phase and jump straight to PARENT_RATING or CLOSED
      [RECEIVED, PARENT_RATING],
      [RECEIVED, CLOSED],
      [RECEIVED, REOPENED],
      // Cannot move back to RECEIVED once escalated
      [IN_PROGRESS, RECEIVED],
      [COUNSELLING_CALL, RECEIVED],
      [ADMIN_CALL, RECEIVED],
      [VISIT, RECEIVED],
      [REOPENED, RECEIVED],
      // PARENT_RATING does not allow going back to RECEIVED or PARENT_RATING
      [PARENT_RATING, RECEIVED],
      [PARENT_RATING, PARENT_RATING],
    ])('%s → %s', (from, to) => {
      expect(canTransitionComplaint(from, to)).toBe(false);
    });
  });

  // ── Self-transitions are always illegal (no status maps to itself) ────────

  describe('self-transitions → false', () => {
    it.each(Object.values(ComplaintStatus))('%s → %s', (status) => {
      expect(canTransitionComplaint(status, status)).toBe(false);
    });
  });
});
