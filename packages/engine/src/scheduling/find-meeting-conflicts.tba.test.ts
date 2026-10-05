/**
 * @file Tests for checking two sections whose meeting days or times are to be announced (GR-02).
 */
import { describe, expect, it } from 'vitest';

import { MeetingLocationKind, type MeetingPattern, Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
} from '@caa/test-kit';

import { findMeetingConflicts } from './find-meeting-conflicts';

const { north } = SYNTHETIC_CAMPUSES;
const { Monday, Wednesday, Tuesday, Thursday } = Weekday;
const S1 = 'c0000000-0000-4000-8000-000000000001';
const S2 = 'c0000000-0000-4000-8000-000000000002';
const MWF = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];

/**
 * Builds an MWF meeting over the whole synthetic term on North campus.
 *
 * @param startTime - Local start time.
 * @param endTime - Local end time.
 * @returns The meeting.
 */
function mwf(startTime: string, endTime: string): MeetingPattern {
  return buildMeetingPattern({
    startTime,
    endTime,
    location: { kind: MeetingLocationKind.OnCampus, campusId: north.id, room: null },
  });
}

/**
 * Builds an evidence reference to a section's first meeting.
 *
 * @param sectionId - The section.
 * @param times - Local start and end, or `null` for a TBA time.
 * @param weekdays - The meeting's weekdays, or `null` for TBA days.
 * @returns The reference.
 */
function ref(
  sectionId: string,
  times: readonly [string, string] | null,
  weekdays: readonly string[] | null,
): Record<string, unknown> {
  return {
    sectionId,
    meetingIndex: 0,
    weekdays,
    startTime: times === null ? null : times[0],
    endTime: times === null ? null : times[1],
  };
}

describe('findMeetingConflicts unknown times (GR-02)', () => {
  it('is UNKNOWN MEETING_TIME_UNKNOWN for a TBA meeting against a timed one', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50')] }, 1);
    const second = buildSection({ meetings: [buildTbaMeeting()] }, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual({
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'UNKNOWN',
      reasonCode: 'MEETING_TIME_UNKNOWN',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        scheduleIssues: [
          {
            reasonCode: 'MEETING_TIME_UNKNOWN',
            meeting: ref(S2, null, null),
            otherMeeting: ref(S1, ['09:00', '09:50'], MWF),
            sharedDates: { firstDate: '2027-01-11', lastDate: '2027-05-07', weekdays: MWF },
            constraintIndex: null,
          },
        ],
      },
    });
  });

  it('names the TBA meeting when it belongs to the first section', () => {
    const first = buildSection({ meetings: [buildTbaMeeting({ weekdays: [Monday] })] }, 1);
    const second = buildSection({ meetings: [mwf('09:00', '09:50')] }, 2);

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.evidence?.scheduleIssues?.[0]).toMatchObject({
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: ref(S1, null, ['MONDAY']),
      otherMeeting: ref(S2, ['09:00', '09:50'], MWF),
    });
  });

  it('is UNKNOWN for a meeting with TBA days whose times overlap, never FAIL', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50')] }, 1);
    const tbaDays = buildMeetingPattern({ weekdays: null, startTime: '09:30', endTime: '10:20' });
    const second = buildSection({ meetings: [tbaDays] }, 2);

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.state).toBe('UNKNOWN');
    expect(check.evidence?.scheduleIssues?.[0]).toMatchObject({
      reasonCode: 'MEETING_TIME_UNKNOWN',
      meeting: ref(S2, ['09:30', '10:20'], null),
    });
  });

  it('passes a TBA time on MW against a timed TTh meeting', () => {
    const tba = buildTbaMeeting({ weekdays: [Monday, Wednesday] });
    const first = buildSection({ meetings: [tba] }, 1);
    const second = buildSection(
      { meetings: [buildMeetingPattern({ weekdays: [Tuesday, Thursday] })] },
      2,
    );

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual({
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'PASS',
    });
  });
});
