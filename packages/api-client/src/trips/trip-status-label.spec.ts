import { tripStatusLabel, tripLabelVariant } from './trip-status-label';
import { formatTripTime } from '../daily-checks/daily-checks.window';

// Deterministic IST times (formatTripTime renders Asia/Kolkata, machine-TZ-independent):
//   01:45Z → 07:15 IST, 02:15Z → 07:45 IST. Derive the exact rendered string from
//   formatTripTime so the assertions test our COMPOSITION, not the runtime ICU's
//   am/AM casing (which differs Node ↔ Hermes).
const SCHED = '2026-07-02T01:45:00.000Z';
const DONE = '2026-07-02T02:15:00.000Z';
const T_SCHED = formatTripTime(SCHED);
const T_DONE = formatTripTime(DONE);
const STOP = 'Baker St';

describe('tripStatusLabel — the single source of truth for parent status copy', () => {
  describe('PICKUP rows from the spec', () => {
    it('SCHEDULED → "Pickup {time} · not started"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'SCHEDULED', boardStatus: 'EXPECTED', scheduledStart: SCHED }),
      ).toEqual({ label: `Pickup ${T_SCHED} · not started`, state: 'scheduled' });
    });

    it('STARTED & not boarded → "Bus on the way · ETA to {stop}"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'STARTED', boardStatus: 'EXPECTED', stopName: STOP }),
      ).toEqual({ label: 'Bus on the way · ETA to Baker St', state: 'enroute' });
    });

    it('BOARDED & live → "On the bus"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'IN_PROGRESS', boardStatus: 'BOARDED', stopName: STOP }),
      ).toEqual({ label: 'On the bus', state: 'onboard' });
    });

    it('NOT_BOARDED live → "Did not board at {stop}"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'STARTED', boardStatus: 'NOT_BOARDED', stopName: STOP }),
      ).toEqual({ label: 'Did not board at Baker St', state: 'not_boarded' });
    });

    it('skipped (rider CANCELLED) → "Pickup skipped"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'SCHEDULED', boardStatus: 'CANCELLED', scheduledStart: SCHED }),
      ).toEqual({ label: 'Pickup skipped', state: 'skipped' });
    });

    it('COMPLETED & boarded → "Reached school · {time}"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'COMPLETED', boardStatus: 'BOARDED', completedAt: DONE }),
      ).toEqual({ label: `Reached school · ${T_DONE}`, state: 'completed' });
    });

    it('COMPLETED & not boarded → "Did not board"', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'COMPLETED', boardStatus: 'NOT_BOARDED' }),
      ).toEqual({ label: 'Did not board', state: 'not_boarded' });
    });
  });

  describe('DROP rows from the spec', () => {
    it('SCHEDULED → "Drop {time} · not started"', () => {
      expect(
        tripStatusLabel({ direction: 'DROP', status: 'SCHEDULED', boardStatus: 'EXPECTED', scheduledStart: SCHED }),
      ).toEqual({ label: `Drop ${T_SCHED} · not started`, state: 'scheduled' });
    });

    it('STARTED & boarded → "On the bus · heading home"', () => {
      expect(
        tripStatusLabel({ direction: 'DROP', status: 'STARTED', boardStatus: 'BOARDED' }),
      ).toEqual({ label: 'On the bus · heading home', state: 'onboard' });
    });

    it('on the way (started, not yet boarded) → "On the way · ETA to {stop}"', () => {
      expect(
        tripStatusLabel({ direction: 'DROP', status: 'IN_PROGRESS', boardStatus: 'EXPECTED', stopName: STOP }),
      ).toEqual({ label: 'On the way · ETA to Baker St', state: 'enroute' });
    });

    it('alighted (ALIGHTED event, still live) → "Dropped at {stop} · {time}"', () => {
      expect(
        tripStatusLabel({ direction: 'DROP', status: 'IN_PROGRESS', boardStatus: 'BOARDED', alightedAt: DONE, stopName: STOP }),
      ).toEqual({ label: `Dropped at Baker St · ${T_DONE}`, state: 'alighted' });
    });

    it('COMPLETED → "Reached {stop}"', () => {
      expect(
        tripStatusLabel({ direction: 'DROP', status: 'COMPLETED', boardStatus: 'BOARDED', stopName: STOP }),
      ).toEqual({ label: 'Reached Baker St', state: 'completed' });
    });
  });

  describe('CORE PRINCIPLE — a finished trip NEVER renders a live label', () => {
    // The exact bug: a COMPLETED trip whose rider row is still BOARDED must not
    // read "On the bus".
    it('COMPLETED pickup + BOARDED is terminal, not "On the bus"', () => {
      const r = tripStatusLabel({ direction: 'PICKUP', status: 'COMPLETED', boardStatus: 'BOARDED', completedAt: DONE });
      expect(r.label).not.toBe('On the bus');
      expect(r.state).toBe('completed');
    });

    it('COMPLETED drop + BOARDED is terminal, not a live "heading home"', () => {
      const r = tripStatusLabel({ direction: 'DROP', status: 'COMPLETED', boardStatus: 'BOARDED', stopName: STOP });
      expect(r.label).not.toContain('heading home');
      expect(r.state).toBe('completed');
    });

    it.each(['CANCELLED', 'ABORTED', 'COMPLETED'])(
      'never returns onboard/enroute for terminal status %s even when BOARDED',
      (status) => {
        for (const direction of ['PICKUP', 'DROP'] as const) {
          const { state } = tripStatusLabel({ direction, status, boardStatus: 'BOARDED', completedAt: DONE, stopName: STOP });
          expect(['onboard', 'enroute']).not.toContain(state);
        }
      },
    );
  });

  describe('whole-trip terminal states', () => {
    it('CANCELLED → direction-specific cancelled label', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'CANCELLED', boardStatus: 'EXPECTED' })).toEqual({
        label: 'Pickup cancelled',
        state: 'cancelled',
      });
      expect(tripStatusLabel({ direction: 'DROP', status: 'CANCELLED', boardStatus: 'EXPECTED' })).toEqual({
        label: 'Drop cancelled',
        state: 'cancelled',
      });
    });

    it('ABORTED → "Trip stopped early"', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'ABORTED', boardStatus: 'BOARDED' })).toEqual({
        label: 'Trip stopped early',
        state: 'aborted',
      });
    });

    it('a whole-trip CANCELLED wins over a child-level skip', () => {
      expect(
        tripStatusLabel({ direction: 'PICKUP', status: 'CANCELLED', boardStatus: 'CANCELLED' }).state,
      ).toBe('cancelled');
    });
  });

  describe('graceful degradation when the payload lacks stop / time', () => {
    it('SCHEDULED without a time drops the time token', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'SCHEDULED' }).label).toBe('Pickup · not started');
      expect(tripStatusLabel({ direction: 'DROP', status: 'SCHEDULED' }).label).toBe('Drop · not started');
    });

    it('live pickup without a stop → "Bus on the way"', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'STARTED', boardStatus: 'EXPECTED' }).label).toBe(
        'Bus on the way',
      );
    });

    it('NOT_BOARDED live without a stop → "Did not board"', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'STARTED', boardStatus: 'NOT_BOARDED' }).label).toBe(
        'Did not board',
      );
    });

    it('COMPLETED pickup boarded without completedAt → "Reached school"', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'COMPLETED', boardStatus: 'BOARDED' }).label).toBe(
        'Reached school',
      );
    });

    it('COMPLETED drop without a stop → "Reached drop-off"', () => {
      expect(tripStatusLabel({ direction: 'DROP', status: 'COMPLETED', boardStatus: 'BOARDED' }).label).toBe(
        'Reached drop-off',
      );
    });

    it('unknown status → honest non-live fallback', () => {
      expect(tripStatusLabel({ direction: 'PICKUP', status: 'WEIRD', boardStatus: 'BOARDED' })).toEqual({
        label: 'Pickup',
        state: 'unknown',
      });
    });

    it('missing status/board treated as pickup unknown', () => {
      expect(tripStatusLabel({}).state).toBe('unknown');
    });
  });

  describe('full matrix — no combination throws and terminal states stay terminal', () => {
    const statuses = ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABORTED'];
    const boards = ['EXPECTED', 'BOARDED', 'NOT_BOARDED', 'CANCELLED', null];
    const directions = ['PICKUP', 'DROP'] as const;
    for (const direction of directions) {
      for (const status of statuses) {
        for (const boardStatus of boards) {
          it(`${direction} / ${status} / ${boardStatus ?? 'null'} yields a non-empty label`, () => {
            const r = tripStatusLabel({ direction, status, boardStatus, scheduledStart: SCHED, completedAt: DONE, stopName: STOP });
            expect(typeof r.label).toBe('string');
            expect(r.label.length).toBeGreaterThan(0);
            // A finished trip is never live.
            if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'ABORTED') {
              expect(['onboard', 'enroute']).not.toContain(r.state);
            }
          });
        }
      }
    }
  });

  describe('tripLabelVariant', () => {
    it('maps each state to a Badge variant string', () => {
      expect(tripLabelVariant('onboard')).toBe('boarded');
      expect(tripLabelVariant('completed')).toBe('success');
      expect(tripLabelVariant('not_boarded')).toBe('not_boarded');
      expect(tripLabelVariant('skipped')).toBe('cancelled');
      expect(tripLabelVariant('aborted')).toBe('error');
      expect(tripLabelVariant('scheduled')).toBe('warning');
      expect(tripLabelVariant('enroute')).toBe('active');
    });
  });
});
