/**
 * @file Tests for comparing meetings whose days or times are to be announced (GR-02).
 */
import { describe, expect, it } from 'vitest';

import { MeetingLocationKind, type MeetingPattern, Weekday } from '@caa/domain';
import {
  buildCampusTransitionPolicy,
  buildMeetingPattern,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
} from '@caa/test-kit';

import { compareMeetings } from './compare-meetings';

const { north, south } = SYNTHETIC_CAMPUSES;
const { Monday, Tuesday, Wednesday, Thursday } = Weekday;
const NO_TRANSITIONS = buildCampusTransitionPolicy();
const WHOLE_TERM_MWF = {
  firstDate: '2027-01-11',
  lastDate: '2027-05-07',
  weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
};

/**
 * Builds an MWF meeting over the whole synthetic term on a campus.
 *
 * @param startTime - Local start time.
 * @param endTime - Local end time.
 * @param campusId - The campus; North by default.
 * @returns The meeting.
 */
function onCampus(startTime: string, endTime: string, campusId: string = north.id): MeetingPattern {
  return buildMeetingPattern({
    startTime,
    endTime,
    location: { kind: MeetingLocationKind.OnCampus, campusId, room: null },
  });
}

describe('compareMeetings unknown times (GR-02)', () => {
  it('is TIME_UNKNOWN for a wholly TBA meeting against a timed one on shared dates', () => {
    const result = compareMeetings(buildTbaMeeting(), onCampus('09:00', '09:50'), NO_TRANSITIONS);

    expect(result).toEqual({ outcome: 'TIME_UNKNOWN', sharedDates: WHOLE_TERM_MWF });
  });

  it('finds no shared date for a TBA time on MW against a timed TTh meeting', () => {
    const tba = buildTbaMeeting({ weekdays: [Monday, Wednesday] });
    const timed = buildMeetingPattern({ weekdays: [Tuesday, Thursday] });

    expect(compareMeetings(tba, timed, NO_TRANSITIONS)).toEqual({ outcome: 'NO_SHARED_DATE' });
  });

  it('is TIME_UNKNOWN for a TBA time on MW against a timed MWF meeting', () => {
    const tba = buildTbaMeeting({ weekdays: [Monday, Wednesday] });

    expect(compareMeetings(onCampus('09:00', '09:50'), tba, NO_TRANSITIONS)).toEqual({
      outcome: 'TIME_UNKNOWN',
      sharedDates: {
        firstDate: '2027-01-11',
        lastDate: '2027-05-05',
        weekdays: ['MONDAY', 'WEDNESDAY'],
      },
    });
  });

  it('finds no shared date for a TBA meeting in the other half-term', () => {
    const tba = buildTbaMeeting({ startsOn: '2027-03-08', endsOn: '2027-05-07' });
    const timed = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-03-05' });

    expect(compareMeetings(timed, tba, NO_TRANSITIONS)).toEqual({ outcome: 'NO_SHARED_DATE' });
  });

  it('is TIME_UNKNOWN for a meeting that bypassed the schema with only a start time', () => {
    const halfKnown: MeetingPattern = {
      weekdays: [Monday],
      startTime: '09:00',
      endTime: null,
      startsOn: '2027-01-11',
      endsOn: '2027-01-11',
      excludedDates: [],
      location: null,
    };
    const timed = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-01-11' });

    expect(compareMeetings(timed, halfKnown, NO_TRANSITIONS).outcome).toBe('TIME_UNKNOWN');
  });

  it('is TIME_UNKNOWN, never OVERLAP, when a meeting with TBA days has overlapping times', () => {
    const tbaDays = buildMeetingPattern({ weekdays: null, startTime: '09:30', endTime: '10:20' });

    expect(compareMeetings(onCampus('09:00', '09:50'), tbaDays, NO_TRANSITIONS)).toEqual({
      outcome: 'TIME_UNKNOWN',
      sharedDates: WHOLE_TERM_MWF,
    });
  });

  it('is TIME_UNKNOWN, never insufficient, when a meeting with TBA days is too close to travel', () => {
    const tbaDays = buildMeetingPattern({
      weekdays: null,
      startTime: '10:00',
      endTime: '10:50',
      location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
    });
    const policy = buildCampusTransitionPolicy({
      transitions: [{ fromCampusId: north.id, toCampusId: south.id, minutes: 15 }],
    });

    const result = compareMeetings(onCampus('09:00', '09:50', north.id), tbaDays, policy);

    expect(result).toEqual({ outcome: 'TIME_UNKNOWN', sharedDates: WHOLE_TERM_MWF });
  });

  it('stays COMPATIBLE for a meeting with TBA days whose times and campus clear the other', () => {
    const tbaDays = buildMeetingPattern({ weekdays: null, startTime: '09:50', endTime: '10:40' });

    expect(compareMeetings(onCampus('09:00', '09:50'), tbaDays, NO_TRANSITIONS)).toEqual({
      outcome: 'COMPATIBLE',
      sharedDates: WHOLE_TERM_MWF,
    });
  });
});
