/**
 * @file Tests for comparing two meetings: half-open overlap, shared dates, TBA times and locations, and campus travel.
 */
import { describe, expect, it } from 'vitest';

import {
  type CampusTransitionPolicy,
  MeetingLocationKind,
  type MeetingPattern,
  Weekday,
} from '@caa/domain';
import {
  buildCampusTransitionPolicy,
  buildMeetingPattern,
  SYNTHETIC_CAMPUSES,
} from '@caa/test-kit';

import { compareMeetings } from './compare-meetings';

const { north, south } = SYNTHETIC_CAMPUSES;
const { Monday } = Weekday;
const NO_TRANSITIONS = buildCampusTransitionPolicy();
const ONLINE = { kind: MeetingLocationKind.Online } as const;
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

/**
 * Builds a transition table with the given ordered pairs.
 *
 * @param pairs - `[from, to, minutes]` entries.
 * @returns The policy.
 */
function transitions(
  ...pairs: readonly (readonly [string, string, number])[]
): CampusTransitionPolicy {
  return buildCampusTransitionPolicy({
    transitions: pairs.map(([fromCampusId, toCampusId, minutes]) => ({
      fromCampusId,
      toCampusId,
      minutes,
    })),
  });
}

describe('compareMeetings overlap', () => {
  it('finds an overlap between MWF 09:00-09:50 and MWF 09:30-10:20', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50'),
      onCampus('09:30', '10:20'),
      NO_TRANSITIONS,
    );

    expect(result).toEqual({ outcome: 'OVERLAP', sharedDates: WHOLE_TERM_MWF });
  });

  it('allows a meeting that starts exactly when the other ends (half-open)', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50'),
      onCampus('09:50', '10:40'),
      NO_TRANSITIONS,
    );

    expect(result).toEqual({ outcome: 'COMPATIBLE', sharedDates: WHOLE_TERM_MWF });
  });

  it('finds an overlap when one meeting lies inside the other', () => {
    const result = compareMeetings(
      onCampus('10:00', '10:30'),
      onCampus('09:00', '11:00'),
      NO_TRANSITIONS,
    );

    expect(result.outcome).toBe('OVERLAP');
  });

  it('finds no shared date for disjoint half-terms at the same weekly time', () => {
    const first = buildMeetingPattern({ startsOn: '2027-01-11', endsOn: '2027-03-05' });
    const second = buildMeetingPattern({ startsOn: '2027-03-08', endsOn: '2027-05-07' });

    expect(compareMeetings(first, second, NO_TRANSITIONS)).toEqual({ outcome: 'NO_SHARED_DATE' });
  });

  it('finds no shared date when the only shared date is excluded', () => {
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

    expect(compareMeetings(first, second, NO_TRANSITIONS)).toEqual({ outcome: 'NO_SHARED_DATE' });
  });

  it('compares wall-clock times across the daylight-saving change on 2027-03-14', () => {
    const dates = { weekdays: [Monday], startsOn: '2027-03-08', endsOn: '2027-03-22' };
    const first = buildMeetingPattern({ ...dates, startTime: '09:00', endTime: '09:50' });
    const second = buildMeetingPattern({ ...dates, startTime: '09:30', endTime: '10:20' });
    const after = buildMeetingPattern({ ...dates, startTime: '09:50', endTime: '10:40' });

    expect(compareMeetings(first, second, NO_TRANSITIONS)).toEqual({
      outcome: 'OVERLAP',
      sharedDates: { firstDate: '2027-03-08', lastDate: '2027-03-22', weekdays: ['MONDAY'] },
    });
    expect(compareMeetings(first, after, NO_TRANSITIONS).outcome).toBe('COMPATIBLE');
  });
});

describe('compareMeetings travel', () => {
  it('is TRANSITION_INSUFFICIENT for North then South with 10 of 15 minutes (AC08)', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50', north.id),
      onCampus('10:00', '10:50', south.id),
      transitions([north.id, south.id, 15]),
    );

    expect(result).toEqual({
      outcome: 'TRANSITION_INSUFFICIENT',
      sharedDates: WHOLE_TERM_MWF,
      transition: {
        fromCampusId: north.id,
        toCampusId: south.id,
        requiredMinutes: 15,
        availableMinutes: 10,
      },
      isFirstEarlier: true,
    });
  });

  it('gives the same transition with the meetings in either order, marking which is earlier', () => {
    const earlier = onCampus('09:00', '09:50', north.id);
    const later = onCampus('10:00', '10:50', south.id);
    const policy = transitions([north.id, south.id, 15]);

    expect(compareMeetings(later, earlier, policy)).toEqual({
      ...compareMeetings(earlier, later, policy),
      isFirstEarlier: false,
    });
  });

  it('is TRANSITION_UNDEFINED for different campuses when the tenant has no table', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50', north.id),
      onCampus('13:00', '13:50', south.id),
      null,
    );

    expect(result).toEqual({
      outcome: 'TRANSITION_UNDEFINED',
      sharedDates: WHOLE_TERM_MWF,
      transition: {
        fromCampusId: north.id,
        toCampusId: south.id,
        requiredMinutes: null,
        availableMinutes: 190,
      },
      isFirstEarlier: true,
    });
  });

  it('is COMPATIBLE when the gap exactly equals the required minutes', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50', north.id),
      onCampus('10:05', '10:55', south.id),
      transitions([north.id, south.id, 15]),
    );

    expect(result).toEqual({ outcome: 'COMPATIBLE', sharedDates: WHOLE_TERM_MWF });
  });

  it('uses the ordered pair from the earlier meeting campus to the later one', () => {
    const result = compareMeetings(
      onCampus('10:00', '10:50', north.id),
      onCampus('09:00', '09:50', south.id),
      transitions([north.id, south.id, 30], [south.id, north.id, 5]),
    );

    expect(result).toEqual({ outcome: 'COMPATIBLE', sharedDates: WHOLE_TERM_MWF });
  });

  it('is TRANSITION_UNDEFINED when only the reverse pair is configured', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50', north.id),
      onCampus('10:00', '10:50', south.id),
      transitions([south.id, north.id, 5]),
    );

    expect(result).toEqual({
      outcome: 'TRANSITION_UNDEFINED',
      sharedDates: WHOLE_TERM_MWF,
      transition: {
        fromCampusId: north.id,
        toCampusId: south.id,
        requiredMinutes: null,
        availableMinutes: 10,
      },
      isFirstEarlier: true,
    });
  });

  it('is TRANSITION_UNDEFINED for an unconfigured pair whatever the gap', () => {
    const result = compareMeetings(
      onCampus('08:00', '08:50', north.id),
      onCampus('15:00', '15:50', south.id),
      NO_TRANSITIONS,
    );

    expect(result.outcome).toBe('TRANSITION_UNDEFINED');
  });

  it('needs no transition between back-to-back meetings on the same campus', () => {
    const result = compareMeetings(
      onCampus('09:00', '09:50', south.id),
      onCampus('09:50', '10:40', south.id),
      NO_TRANSITIONS,
    );

    expect(result).toEqual({ outcome: 'COMPATIBLE', sharedDates: WHOLE_TERM_MWF });
  });

  it('needs no transition to or from an online meeting', () => {
    const online = buildMeetingPattern({ startTime: '10:00', endTime: '10:50', location: ONLINE });

    expect(compareMeetings(onCampus('09:00', '09:50'), online, NO_TRANSITIONS).outcome).toBe(
      'COMPATIBLE',
    );
    expect(compareMeetings(online, onCampus('11:00', '11:50'), NO_TRANSITIONS).outcome).toBe(
      'COMPATIBLE',
    );
  });

  it('is LOCATION_UNKNOWN for a timed meeting with a TBA location next to a campus meeting', () => {
    const unplaced = buildMeetingPattern({ startTime: '10:00', endTime: '10:50', location: null });

    expect(compareMeetings(onCampus('09:00', '09:50'), unplaced, NO_TRANSITIONS)).toEqual({
      outcome: 'LOCATION_UNKNOWN',
      sharedDates: WHOLE_TERM_MWF,
    });
  });

  it('needs no transition between a TBA location and an online meeting', () => {
    const unplaced = buildMeetingPattern({ startTime: '09:00', endTime: '09:50', location: null });
    const online = buildMeetingPattern({ startTime: '10:00', endTime: '10:50', location: ONLINE });

    expect(compareMeetings(unplaced, online, NO_TRANSITIONS).outcome).toBe('COMPATIBLE');
  });
});
