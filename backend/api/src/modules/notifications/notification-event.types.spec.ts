/**
 * Unit tests for school-aware TRIP_START / TRIP_END copy selection (ITEM a).
 *
 * The body/title are pure functions of the dispatch variables, so we exercise
 * them directly — no engine, no DB. Asserts:
 *   - DROP start / PICKUP end are school-anchored ("from {school}" / "reached {school}")
 *   - PICKUP start / DROP end stay generic (stop-relative / "its trip")
 *   - {school} degrades to "the school" when no schoolName is supplied (never "undefined")
 */
import { NotifCategory } from '@yaanam/types';
import { NOTIFICATION_EVENT_SPECS } from './notification-event.types';

const start = NOTIFICATION_EVENT_SPECS[NotifCategory.TRIP_START]!;
const end = NOTIFICATION_EVENT_SPECS[NotifCategory.TRIP_END]!;

describe('school-aware trip notification copy', () => {
  describe('TRIP_START', () => {
    it('DROP starts FROM the school (school-anchored)', () => {
      const body = start.body({ routeName: 'Route A', direction: 'DROP', schoolName: 'Green Valley School' });
      expect(body).toBe('The Route A bus has started from Green Valley School. Track it live.');
    });

    it('PICKUP start stays generic (not school-anchored)', () => {
      const body = start.body({ routeName: 'Route A', direction: 'PICKUP', schoolName: 'Green Valley School' });
      expect(body).toBe('The bus on Route A (pickup) has started its trip. Track it live.');
      expect(body).not.toContain('Green Valley School');
    });

    it('DROP start with no school name falls back to "the school" (no "undefined")', () => {
      const body = start.body({ routeName: 'Route A', direction: 'DROP' });
      expect(body).toBe('The Route A bus has started from the school. Track it live.');
      expect(body).not.toMatch(/undefined/);
    });
  });

  describe('TRIP_END', () => {
    it('PICKUP ends by REACHING the school (school-anchored)', () => {
      const body = end.body({ routeName: 'Route A', direction: 'PICKUP', schoolName: 'Green Valley School' });
      expect(body).toBe('The Route A bus has reached Green Valley School.');
      const title = end.title({ routeName: 'Route A', direction: 'PICKUP', schoolName: 'Green Valley School' });
      expect(title).toBe('Route A — reached Green Valley School');
    });

    it('DROP end stays generic (not school-anchored)', () => {
      const body = end.body({ routeName: 'Route A', direction: 'DROP', schoolName: 'Green Valley School' });
      expect(body).toBe('The bus on Route A (drop) has completed its trip.');
      expect(body).not.toContain('Green Valley School');
    });

    it('PICKUP end with no school name falls back to "the school" (no "undefined")', () => {
      const body = end.body({ routeName: 'Route A', direction: 'PICKUP' });
      expect(body).toBe('The Route A bus has reached the school.');
      expect(body).not.toMatch(/undefined/);
    });
  });
});
