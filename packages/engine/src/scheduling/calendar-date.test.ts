/**
 * @file Tests for calendar-date arithmetic: day numbers, their inverse, and weekdays.
 */
import { describe, expect, it } from 'vitest';

import { calendarDateOf, dayNumberOf, weekdayIndexOf, WEEKDAYS_IN_ORDER } from './calendar-date';

describe('dayNumberOf', () => {
  it('counts 1970-01-01 as day 0', () => {
    expect(dayNumberOf('1970-01-01')).toBe(0);
  });

  it('counts a leap day from 1970-01-01', () => {
    expect(dayNumberOf('2000-02-29')).toBe(11016);
  });

  it('counts the daylight-saving Sunday of the synthetic term', () => {
    expect(dayNumberOf('2027-03-14')).toBe(20891);
  });

  it('counts dates before 1970 as negative', () => {
    expect(dayNumberOf('1969-12-31')).toBe(-1);
  });

  it('skips February 29 in a century year that is not a leap year', () => {
    expect(dayNumberOf('1900-03-01') - dayNumberOf('1900-02-28')).toBe(1);
  });

  it('keeps February 29 in a century year divisible by 400', () => {
    expect(dayNumberOf('2000-03-01') - dayNumberOf('2000-02-28')).toBe(2);
  });
});

describe('calendarDateOf', () => {
  it('converts day 0 to 1970-01-01', () => {
    expect(calendarDateOf(0)).toBe('1970-01-01');
  });

  it('converts a negative day number to a date before 1970', () => {
    expect(calendarDateOf(-1)).toBe('1969-12-31');
  });

  it('converts a leap day back to its date', () => {
    expect(calendarDateOf(11016)).toBe('2000-02-29');
  });

  it.each(['0000-03-01', '0001-01-01', '1600-02-29', '1900-02-28', '2027-12-31', '9999-12-31'])(
    'round-trips %s',
    (date) => {
      expect(calendarDateOf(dayNumberOf(date))).toBe(date);
    },
  );
});

describe('weekdayIndexOf', () => {
  it('places 1970-01-01 on a Thursday', () => {
    expect(WEEKDAYS_IN_ORDER[weekdayIndexOf(0)]).toBe('THURSDAY');
  });

  it('places a negative day number on the right weekday', () => {
    expect(WEEKDAYS_IN_ORDER[weekdayIndexOf(-1)]).toBe('WEDNESDAY');
  });

  it('places the synthetic term start on a Monday and the daylight-saving date on a Sunday', () => {
    expect(WEEKDAYS_IN_ORDER[weekdayIndexOf(dayNumberOf('2027-01-11'))]).toBe('MONDAY');
    expect(WEEKDAYS_IN_ORDER[weekdayIndexOf(20891)]).toBe('SUNDAY');
  });
});
