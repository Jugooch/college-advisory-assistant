/**
 * @file Tests for the synthetic meeting pattern builders.
 */
import { describe, expect, it } from 'vitest';

import { MeetingPatternSchema } from '@caa/domain';

import {
  buildHalfTermMeeting,
  buildMeetingPattern,
  buildTbaMeeting,
} from './meeting-pattern.builder';

const NORTH_CAMPUS_ID = 'd0000000-0000-4000-8000-000000000001';

describe('buildMeetingPattern', () => {
  it('defaults to MWF 09:00 to 09:50 over the whole 2027SP term on the north campus', () => {
    expect(buildMeetingPattern()).toEqual({
      weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '09:50',
      startsOn: '2027-01-11',
      endsOn: '2027-05-07',
      excludedDates: [],
      location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
    });
  });

  it('returns deep-equal meetings for the same arguments', () => {
    expect(buildMeetingPattern({ startTime: '10:00', endTime: '10:50' })).toEqual(
      buildMeetingPattern({ startTime: '10:00', endTime: '10:50' }),
    );
  });

  it('applies overrides, including excluded dates and an online location', () => {
    const meeting = buildMeetingPattern({
      excludedDates: ['2027-01-18'],
      location: { kind: 'ONLINE' },
    });

    expect([meeting.excludedDates, meeting.location]).toEqual([['2027-01-18'], { kind: 'ONLINE' }]);
  });

  it('returns a meeting that passes the domain schema', () => {
    expect(MeetingPatternSchema.safeParse(buildMeetingPattern()).success).toBe(true);
  });

  it('rejects an end time that is not after the start time', () => {
    expect(() => buildMeetingPattern({ startTime: '09:50', endTime: '09:50' })).toThrow();
  });

  it('rejects a meeting with only one time known', () => {
    expect(() => buildMeetingPattern({ endTime: null })).toThrow();
  });
});

describe('buildHalfTermMeeting', () => {
  it('runs MWF 09:00 to 09:50 in the first half, 2027-01-11 to 2027-03-05', () => {
    expect(buildHalfTermMeeting('first')).toEqual({
      weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '09:00',
      endTime: '09:50',
      startsOn: '2027-01-11',
      endsOn: '2027-03-05',
      excludedDates: [],
      location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
    });
  });

  it('runs at the same time in the second half, 2027-03-08 to 2027-05-07', () => {
    const meeting = buildHalfTermMeeting('second');

    expect([meeting.startsOn, meeting.endsOn, meeting.startTime, meeting.endTime]).toEqual([
      '2027-03-08',
      '2027-05-07',
      '09:00',
      '09:50',
    ]);
  });

  it('applies overrides over the half-term dates', () => {
    expect(buildHalfTermMeeting('first', { endsOn: '2027-02-26' }).endsOn).toBe('2027-02-26');
  });
});

describe('buildTbaMeeting', () => {
  it('leaves the days, times and location to be announced over the whole term', () => {
    expect(buildTbaMeeting()).toEqual({
      weekdays: null,
      startTime: null,
      endTime: null,
      startsOn: '2027-01-11',
      endsOn: '2027-05-07',
      excludedDates: [],
      location: null,
    });
  });

  it('accepts known days with unknown times', () => {
    expect(buildTbaMeeting({ weekdays: ['TUESDAY'] })).toMatchObject({
      weekdays: ['TUESDAY'],
      startTime: null,
      endTime: null,
    });
  });

  it('rejects a TBA meeting with only a start time', () => {
    expect(() => buildTbaMeeting({ startTime: '09:00' })).toThrow();
  });
});
