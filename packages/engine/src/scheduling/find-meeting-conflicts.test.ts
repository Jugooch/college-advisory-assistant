/**
 * @file Tests for checking two sections' meetings for time conflicts, with stable evidence.
 */
import { describe, expect, it } from 'vitest';

import { MeetingLocationKind, type MeetingPattern, Weekday } from '@caa/domain';
import {
  buildCampusTransitionPolicy,
  buildHalfTermSection,
  buildMeetingPattern,
  buildOnlineAsynchronousSection,
  buildSection,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { findMeetingConflicts } from './find-meeting-conflicts';
import { ScheduleInputError } from './schedule-input-error';

const { north } = SYNTHETIC_CAMPUSES;
const { Monday } = Weekday;
const S1 = 'c0000000-0000-4000-8000-000000000001';
const S2 = 'c0000000-0000-4000-8000-000000000002';
const MWF = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
const WHOLE_TERM_MWF = { firstDate: '2027-01-11', lastDate: '2027-05-07', weekdays: MWF };
const PASS = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

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
 * @param times - Local start and end.
 * @param weekdays - The meeting's weekdays; MWF by default.
 * @returns The reference.
 */
function ref(
  sectionId: string,
  times: readonly [string, string],
  weekdays: readonly string[] = MWF,
): Record<string, unknown> {
  return { sectionId, meetingIndex: 0, weekdays, startTime: times[0], endTime: times[1] };
}

describe('findMeetingConflicts time conflicts', () => {
  it('fails MWF 09:00-09:50 against MWF 09:30-10:20 with MEETING_CONFLICT', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50')] }, 1);
    const second = buildSection({ meetings: [mwf('09:30', '10:20')] }, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual({
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'FAIL',
      reasonCode: 'MEETING_CONFLICT',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        scheduleIssues: [
          {
            reasonCode: 'MEETING_CONFLICT',
            first: ref(S1, ['09:00', '09:50']),
            second: ref(S2, ['09:30', '10:20']),
            sharedDates: WHOLE_TERM_MWF,
          },
        ],
      },
    });
  });

  it('gives a deep-equal result with the sections swapped', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50'), buildTbaMeeting()] }, 1);
    const second = buildSection({ meetings: [mwf('09:30', '10:20')] }, 2);

    expect(findMeetingConflicts({ first: second, second: first, transitionPolicy: null })).toEqual(
      findMeetingConflicts({ first, second, transitionPolicy: null }),
    );
  });

  it('passes 09:00-09:50 against 09:50-10:40 on one campus (half-open)', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50')] }, 1);
    const second = buildSection({ meetings: [mwf('09:50', '10:40')] }, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(PASS);
  });

  it('passes disjoint half-terms at the same weekly time (AC07)', () => {
    const first = buildHalfTermSection('first', {}, 1);
    const second = buildHalfTermSection('second', {}, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(PASS);
  });

  it('passes meetings whose only shared date is excluded', () => {
    const excluding = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-01-11',
      endsOn: '2027-01-25',
      excludedDates: ['2027-01-18'],
    });
    const oneDay = buildMeetingPattern({
      weekdays: [Monday],
      startsOn: '2027-01-18',
      endsOn: '2027-01-18',
    });
    const first = buildSection({ meetings: [excluding] }, 1);
    const second = buildSection({ meetings: [oneDay] }, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(PASS);
  });

  it('keeps wall-clock times across the daylight-saving change on 2027-03-14', () => {
    const dates = { weekdays: [Monday], startsOn: '2027-03-08', endsOn: '2027-03-22' };
    const first = buildSection(
      { meetings: [buildMeetingPattern({ ...dates, startTime: '09:00', endTime: '09:50' })] },
      1,
    );
    const second = buildSection(
      { meetings: [buildMeetingPattern({ ...dates, startTime: '09:30', endTime: '10:20' })] },
      2,
    );

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.state).toBe('FAIL');
    expect(check.evidence?.scheduleIssues?.[0]).toEqual({
      reasonCode: 'MEETING_CONFLICT',
      first: ref(S1, ['09:00', '09:50'], ['MONDAY']),
      second: ref(S2, ['09:30', '10:20'], ['MONDAY']),
      sharedDates: { firstDate: '2027-03-08', lastDate: '2027-03-22', weekdays: ['MONDAY'] },
    });
  });

  it('passes an online asynchronous section against any timed section', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50')] }, 1);
    const second = buildOnlineAsynchronousSection({}, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(PASS);
  });

  it('lists only the FAIL issues, naming the meeting index, when a pair also has an unknown', () => {
    const first = buildSection({ meetings: [buildTbaMeeting(), mwf('09:00', '09:50')] }, 1);
    const second = buildSection({ meetings: [mwf('09:30', '10:20')] }, 2);

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.state).toBe('FAIL');
    expect(check.reasonCode).toBe('MEETING_CONFLICT');
    expect(check.evidence?.scheduleIssues).toEqual([
      {
        reasonCode: 'MEETING_CONFLICT',
        first: { ...ref(S1, ['09:00', '09:50']), meetingIndex: 1 },
        second: ref(S2, ['09:30', '10:20']),
        sharedDates: WHOLE_TERM_MWF,
      },
    ]);
  });

  it('throws sameSection when a section is compared with itself', () => {
    const section = buildSection({}, 1);

    expect(() =>
      findMeetingConflicts({ first: section, second: section, transitionPolicy: null }),
    ).toThrow(new ScheduleInputError('sameSection'));
  });

  it('throws tenantMismatch for sections of two tenants', () => {
    const other = buildSection({ tenantId: SYNTHETIC_TENANTS.b.id }, 2);

    expect(() =>
      findMeetingConflicts({ first: buildSection({}, 1), second: other, transitionPolicy: null }),
    ).toThrow(new ScheduleInputError('tenantMismatch'));
  });

  it("throws tenantMismatch for another tenant's transition table", () => {
    const transitionPolicy = buildCampusTransitionPolicy({ tenantId: SYNTHETIC_TENANTS.b.id });

    expect(() =>
      findMeetingConflicts({
        first: buildSection({}, 1),
        second: buildSection({}, 2),
        transitionPolicy,
      }),
    ).toThrow(new ScheduleInputError('tenantMismatch'));
  });

  it("accepts the sections' own tenant's transition table", () => {
    const result = findMeetingConflicts({
      first: buildSection({}, 1),
      second: buildSection({ meetings: [mwf('10:00', '10:50')] }, 2),
      transitionPolicy: buildCampusTransitionPolicy(),
    });

    expect(result).toEqual(PASS);
  });
});
