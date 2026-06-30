/**
 * Unit tests for `resolveSchoolAnchor` — the pure helper that resolves a trip's
 * "school end" (per-trip override → tenant school coords → none) and its geometry
 * role (DESTINATION for a PICKUP, ORIGIN for a DROP). No mocking required.
 */
import { Direction } from '@yaanam/types';
import { resolveSchoolAnchor } from './school-anchor.util';

const TENANT = { schoolLat: 12.9716, schoolLng: 77.5946, schoolName: 'Main Campus' };

describe('resolveSchoolAnchor', () => {
  describe('per-trip override takes precedence', () => {
    it('uses the trip anchor over the tenant coords', () => {
      const anchor = resolveSchoolAnchor(
        { direction: Direction.PICKUP, anchorLat: 1.5, anchorLng: 2.5, anchorLabel: 'Sports ground' },
        TENANT,
      );
      expect(anchor).toEqual({ lat: 1.5, lng: 2.5, label: 'Sports ground', role: 'DESTINATION' });
    });

    it('label is null when the override has no label', () => {
      const anchor = resolveSchoolAnchor(
        { direction: Direction.DROP, anchorLat: 1.5, anchorLng: 2.5 },
        TENANT,
      );
      expect(anchor).toEqual({ lat: 1.5, lng: 2.5, label: null, role: 'ORIGIN' });
    });
  });

  describe('falls back to tenant school coordinates', () => {
    it('uses tenant coords + schoolName when the trip has no override', () => {
      const anchor = resolveSchoolAnchor({ direction: Direction.PICKUP }, TENANT);
      expect(anchor).toEqual({ lat: 12.9716, lng: 77.5946, label: 'Main Campus', role: 'DESTINATION' });
    });

    it('falls back when only one override coordinate is present (half-set is ignored)', () => {
      const anchor = resolveSchoolAnchor({ direction: Direction.DROP, anchorLat: 9.9 }, TENANT);
      expect(anchor).toEqual({ lat: 12.9716, lng: 77.5946, label: 'Main Campus', role: 'ORIGIN' });
    });
  });

  describe('role follows the trip direction', () => {
    it('PICKUP → DESTINATION (school is after the last stop)', () => {
      expect(resolveSchoolAnchor({ direction: Direction.PICKUP }, TENANT)?.role).toBe('DESTINATION');
    });
    it('DROP → ORIGIN (school is before the first stop)', () => {
      expect(resolveSchoolAnchor({ direction: Direction.DROP }, TENANT)?.role).toBe('ORIGIN');
    });
  });

  describe('absent gracefully when nothing is set', () => {
    it('returns null when neither override nor tenant coords exist', () => {
      expect(resolveSchoolAnchor({ direction: Direction.PICKUP }, { schoolName: 'No coords yet' })).toBeNull();
    });
    it('returns null when the tenant is null/undefined and no override', () => {
      expect(resolveSchoolAnchor({ direction: Direction.DROP }, null)).toBeNull();
      expect(resolveSchoolAnchor({ direction: Direction.DROP }, undefined)).toBeNull();
    });
  });
});
