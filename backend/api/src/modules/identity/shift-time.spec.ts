/**
 * Unit tests for the shift time validator — the single regex shared by the
 * create/update AgeGroup (shift) DTOs and exercised here directly, so the rule
 * the API enforces is the rule we test. Pure function; no mocking.
 */
import { isValidShiftTime, SHIFT_TIME_PATTERN } from './shift-time.util';

describe('isValidShiftTime', () => {
  describe('valid 24-hour HH:MM → true', () => {
    it.each(['00:00', '08:00', '09:05', '12:30', '14:30', '23:59', '19:45'])(
      '%s is valid',
      (t) => expect(isValidShiftTime(t)).toBe(true),
    );
  });

  describe('invalid → false', () => {
    it.each([
      '8:00', // missing leading zero on the hour
      '24:00', // hour out of range
      '23:60', // minute out of range
      '12:60',
      '08:0', // single-digit minute
      '08:000', // too many minute digits
      '0800', // no colon
      '08-00', // wrong separator
      '', // empty
      'ab:cd', // non-numeric
      ' 08:00', // leading space
      '08:00 ', // trailing space
    ])('%p is invalid', (t) => expect(isValidShiftTime(t)).toBe(false));
  });

  it('exposes the same pattern the DTO uses', () => {
    expect(SHIFT_TIME_PATTERN.test('08:00')).toBe(true);
    expect(SHIFT_TIME_PATTERN.test('8:00')).toBe(false);
  });
});
