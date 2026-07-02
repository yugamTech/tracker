import { pickTripRider, sortParentTrips, compareParentTrips } from './trip-selection';

describe('pickTripRider — trip detail shows the trip’s own child, not stale shared state', () => {
  const guarded = new Set(['A', 'B']);

  it('returns the guarded rider on the trip', () => {
    const r = pickTripRider([{ studentId: 'A' }], guarded);
    expect(r?.studentId).toBe('A');
  });

  it('the CORE bug: a stale preferred child NOT on the trip never wins — falls back to the trip’s rider', () => {
    // Parent switched active child to B, then opens child A's trip (carries only A).
    const r = pickTripRider([{ studentId: 'A' }], guarded, 'B');
    expect(r?.studentId).toBe('A');
  });

  it('honours the preferred child only when they are actually a rider on the trip (sibling trip)', () => {
    const r = pickTripRider([{ studentId: 'A' }, { studentId: 'B' }], guarded, 'B');
    expect(r?.studentId).toBe('B');
  });

  it('ignores riders the parent does not guard', () => {
    const r = pickTripRider([{ studentId: 'Z' }, { studentId: 'A' }], guarded);
    expect(r?.studentId).toBe('A');
  });

  it('returns null when the parent guards none of the trip’s riders', () => {
    expect(pickTripRider([{ studentId: 'Z' }], guarded)).toBeNull();
    expect(pickTripRider([], guarded)).toBeNull();
    expect(pickTripRider(null, guarded)).toBeNull();
  });

  it('accepts a plain array of guarded ids', () => {
    expect(pickTripRider([{ studentId: 'A' }], ['A'])?.studentId).toBe('A');
  });
});

describe('sortParentTrips — deterministic home order (live → upcoming → finished)', () => {
  const live = { status: 'IN_PROGRESS', scheduledStart: '2026-07-02T02:00:00.000Z' };
  const startedEarly = { status: 'STARTED', scheduledStart: '2026-07-02T01:00:00.000Z' };
  const soon = { status: 'SCHEDULED', scheduledStart: '2026-07-02T03:00:00.000Z' };
  const later = { status: 'SCHEDULED', scheduledStart: '2026-07-02T09:00:00.000Z' };
  const doneOld = { status: 'COMPLETED', scheduledStart: '2026-07-01T01:00:00.000Z', completedAt: '2026-07-01T02:00:00.000Z' };
  const doneRecent = { status: 'COMPLETED', scheduledStart: '2026-07-02T01:00:00.000Z', completedAt: '2026-07-02T01:40:00.000Z' };
  const aborted = { status: 'ABORTED', scheduledStart: '2026-07-02T00:30:00.000Z', completedAt: '2026-07-02T00:45:00.000Z' };

  it('live trips come first, then upcoming soonest-first, then finished most-recent-first', () => {
    const order = sortParentTrips([later, doneOld, live, soon, startedEarly, doneRecent, aborted]);
    expect(order).toEqual([
      startedEarly, // live, earlier start
      live, // live, later start
      soon, // upcoming, soonest
      later, // upcoming, later
      doneRecent, // finished, most recent
      aborted, // finished
      doneOld, // finished, oldest
    ]);
  });

  it('never depends on input array order (the old childTrips[0] bug)', () => {
    const a = sortParentTrips([doneOld, soon, live]);
    const b = sortParentTrips([live, doneOld, soon]);
    expect(a).toEqual(b);
    expect(a[0]).toBe(live); // the running trip is always the hero
  });

  it('does not mutate its input', () => {
    const input = [soon, live];
    const copy = [...input];
    sortParentTrips(input);
    expect(input).toEqual(copy);
  });

  it('sorts trips with unknown timestamps last within their tier', () => {
    const noTime = { status: 'SCHEDULED' };
    const withTime = { status: 'SCHEDULED', scheduledStart: '2026-07-02T03:00:00.000Z' };
    expect(sortParentTrips([noTime, withTime])).toEqual([withTime, noTime]);
  });

  it('compareParentTrips is a consistent comparator (live < scheduled < done)', () => {
    expect(compareParentTrips(live, soon)).toBeLessThan(0);
    expect(compareParentTrips(soon, doneRecent)).toBeLessThan(0);
    expect(compareParentTrips(doneRecent, live)).toBeGreaterThan(0);
  });
});
