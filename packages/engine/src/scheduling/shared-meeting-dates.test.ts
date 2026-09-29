/**
 * @file Tests for finding the dates two recurring meetings share: intervals, weekdays, exclusions, and TBA days.
 */
import { describe, expect, it } from 'vitest';

import { Weekday } from '@caa/domain';
import { buildMeetingPattern } from '@caa/test-kit';

import { findSharedMeetingDates } from './shared-meeting-dates';

const { Monday, Tuesday, Wednesday, Thursday, Friday } = Weekday;

describe('findSharedMeetingDates', () => {
  it('returns the whole term for two MWF meetings over the same term', () => {
    const first = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-05-07' });
    const second = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-05-07' });

    expect(findSharedMeetingDates(first, second)).toEqual({
      firstDate: '2027-01-11',
      lastDate: '2027-05-07',
      weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    });
  });

  it('returns null for disjoint half-terms at the same weekly time', () => {
    const first = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-03-05' });
    const second = buildMeetingPattern({ startsOn: '2027-03-08', endsOn: '2027-05-07' });

    expect(findSharedMeetingDates(first, second)).toBeNull();
  });

  it('returns null for meetings on different weekdays over the same term', () => {
    const first = buildMeetingPattern({ weekdays: [Monday, Wednesday] });
    const second = buildMeetingPattern({ weekdays: [Tuesday, Thursday] });

    expect(findSharedMeetingDates(first, second)).toBeNull();
  });

  it('returns the one date where two half-terms touch', () => {
    const first = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-01-11',
      endsOn: '2027-03-08',
    });
    const second = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-03-08',
      endsOn: '2027-05-07',
    });

    expect(findSharedMeetingDates(first, second)).toEqual({
      firstDate: '2027-03-08',
      lastDate: '2027-03-08',
      weekdays: ['MONDAY'],
    });
  });

  it('returns null when the only shared date is excluded', () => {
    const first = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-25',
      excludedDates: ['2027-01-18'],
    });
    const second = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-01-18',
      endsOn: '2027-01-18',
    });

    expect(findSharedMeetingDates(first, second)).toBeNull();
  });

  it('skips excluded dates at both ends of the shared interval', () => {
    const first = buildMeetingPattern({
      weekdays: [Monday, Wednesday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-27',
      excludedDates: ['2027-01-11', '2027-01-27'],
    });
    const second = buildMeetingPattern({
      weekdays: [Monday, Wednesday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-27',
    });

    expect(findSharedMeetingDates(first, second)).toEqual({
      firstDate: '2027-01-13',
      lastDate: '2027-01-25',
      weekdays: ['MONDAY', 'WEDNESDAY'],
    });
  });

  it('leaves out a weekday whose every shared date is excluded', () => {
    const first = buildMeetingPattern({
      weekdays: [Monday, Wednesday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-17',
      excludedDates: ['2027-01-13'],
    });
    const second = buildMeetingPattern({
      weekdays: [Monday, Wednesday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-17',
    });

    expect(findSharedMeetingDates(first, second)).toEqual({
      firstDate: '2027-01-11',
      lastDate: '2027-01-11',
      weekdays: ['MONDAY'],
    });
  });

  it('counts every weekday for a meeting whose weekdays are to be announced (GR-02)', () => {
    const tba = buildMeetingPattern({ weekdays: null });
    const timed = buildMeetingPattern({ weekdays: [Tuesday, Thursday] });

    expect(findSharedMeetingDates(tba, timed)).toEqual({
      firstDate: '2027-01-12',
      lastDate: '2027-05-06',
      weekdays: ['TUESDAY', 'THURSDAY'],
    });
  });

  it('returns every weekday, Monday first, when both meetings have days to be announced', () => {
    const first = buildMeetingPattern({ weekdays: null });
    const second = buildMeetingPattern({ weekdays: null });

    expect(findSharedMeetingDates(first, second)).toEqual({
      firstDate: '2027-01-11',
      lastDate: '2027-05-07',
      weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    });
  });

  it('gives a deep-equal result with the meetings and weekdays in either order', () => {
    const first = buildMeetingPattern({
      weekdays: [Friday, Monday],
      startsOn: '2027-01-11',
      endsOn: '2027-03-05',
      excludedDates: ['2027-01-15'],
    });
    const second = buildMeetingPattern({
      weekdays: [Monday, Wednesday, Friday],
      startsOn: '2027-01-13',
      endsOn: '2027-05-07',
    });

    const result = findSharedMeetingDates(first, second);

    expect(findSharedMeetingDates(second, first)).toEqual(result);
    expect(result).toEqual({
      firstDate: '2027-01-18',
      lastDate: '2027-03-05',
      weekdays: ['MONDAY', 'FRIDAY'],
    });
  });
});
