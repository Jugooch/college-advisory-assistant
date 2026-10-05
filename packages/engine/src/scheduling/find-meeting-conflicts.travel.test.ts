/**
 * @file Tests for checking two sections' meetings for campus travel time (AC08).
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import {
  type CampusTransitionPolicy,
  MeetingLocationKind,
  type MeetingPattern,
  SectionModality,
} from '@caa/domain';
import {
  buildCampusTransitionPolicy,
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
} from '@caa/test-kit';

import { findMeetingConflicts } from './find-meeting-conflicts';

const { north, south } = SYNTHETIC_CAMPUSES;
const S1 = 'c0000000-0000-4000-8000-000000000001';
const S2 = 'c0000000-0000-4000-8000-000000000002';
const MWF = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
const WHOLE_TERM_MWF = { firstDate: '2027-01-11', lastDate: '2027-05-07', weekdays: MWF };
const PASS = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

/**
 * Builds an MWF meeting over the whole synthetic term.
 *
 * @param startTime - Local start time.
 * @param endTime - Local end time.
 * @param campusId - The campus, or `null` for a location to be announced.
 * @returns The meeting.
 */
function mwf(startTime: string, endTime: string, campusId: string | null): MeetingPattern {
  return buildMeetingPattern({
    startTime,
    endTime,
    location:
      campusId === null ? null : { kind: MeetingLocationKind.OnCampus, campusId, room: null },
  });
}

/**
 * Builds a transition table with one ordered pair.
 *
 * @param minutes - Minutes required from North to South.
 * @returns The policy.
 */
function northToSouth(minutes: number): CampusTransitionPolicy {
  return buildCampusTransitionPolicy({
    transitions: [{ fromCampusId: north.id, toCampusId: south.id, minutes }],
  });
}

/**
 * Builds an evidence reference to a section's first MWF meeting.
 *
 * @param sectionId - The section.
 * @param startTime - Local start time.
 * @param endTime - Local end time.
 * @returns The reference.
 */
function ref(sectionId: string, startTime: string, endTime: string): Record<string, unknown> {
  return { sectionId, meetingIndex: 0, weekdays: MWF, startTime, endTime };
}

/**
 * Builds the UNKNOWN or FAIL check a single issue explains.
 *
 * @param state - The check state.
 * @param issue - The one schedule issue.
 * @returns The expected check.
 */
function checkWith(state: string, issue: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: 'SCHEDULE_FEASIBILITY',
    state,
    reasonCode: issue.reasonCode,
    evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: [issue] },
  };
}

describe('findMeetingConflicts travel', () => {
  it('fails North then South with 10 of 15 minutes as TRANSITION_TIME_INSUFFICIENT (AC08)', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50', north.id)] }, 1);
    const second = buildSection(
      { campusId: south.id, meetings: [mwf('10:00', '10:50', south.id)] },
      2,
    );

    expect(findMeetingConflicts({ first, second, transitionPolicy: northToSouth(15) })).toEqual(
      checkWith('FAIL', {
        reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
        earlier: ref(S1, '09:00', '09:50'),
        later: ref(S2, '10:00', '10:50'),
        sharedDates: WHOLE_TERM_MWF,
        fromCampusId: north.id,
        toCampusId: south.id,
        availableMinutes: 10,
        requiredMinutes: 15,
      }),
    );
  });

  it('puts the earlier meeting first when it belongs to the second section', () => {
    const first = buildSection(
      { campusId: south.id, meetings: [mwf('10:00', '10:50', south.id)] },
      1,
    );
    const second = buildSection({ meetings: [mwf('09:00', '09:50', north.id)] }, 2);

    const check = findMeetingConflicts({ first, second, transitionPolicy: northToSouth(15) });

    expect(check.evidence?.scheduleIssues?.[0]).toMatchObject({
      earlier: ref(S2, '09:00', '09:50'),
      later: ref(S1, '10:00', '10:50'),
    });
  });

  it('is UNKNOWN TRANSITION_TIME_UNDEFINED for an unconfigured pair, never PASS', () => {
    const first = buildSection({ meetings: [mwf('08:00', '08:50', north.id)] }, 1);
    const second = buildSection(
      { campusId: south.id, meetings: [mwf('15:00', '15:50', south.id)] },
      2,
    );

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(
      checkWith('UNKNOWN', {
        reasonCode: 'TRANSITION_TIME_UNDEFINED',
        earlier: ref(S1, '08:00', '08:50'),
        later: ref(S2, '15:00', '15:50'),
        sharedDates: WHOLE_TERM_MWF,
        fromCampusId: north.id,
        toCampusId: south.id,
        availableMinutes: 370,
        requiredMinutes: null,
      }),
    );
  });

  it('passes a gap exactly equal to the required minutes', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50', north.id)] }, 1);
    const second = buildSection(
      { campusId: south.id, meetings: [mwf('10:05', '10:55', south.id)] },
      2,
    );

    expect(findMeetingConflicts({ first, second, transitionPolicy: northToSouth(15) })).toEqual(
      PASS,
    );
  });

  it('is UNKNOWN MEETING_LOCATION_UNKNOWN for a TBA location next to a campus meeting', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50', null)] }, 1);
    const second = buildSection({ meetings: [mwf('13:00', '13:50', north.id)] }, 2);

    expect(findMeetingConflicts({ first, second, transitionPolicy: northToSouth(15) })).toEqual(
      checkWith('UNKNOWN', {
        reasonCode: 'MEETING_LOCATION_UNKNOWN',
        meeting: ref(S1, '09:00', '09:50'),
        otherMeeting: ref(S2, '13:00', '13:50'),
        sharedDates: WHOLE_TERM_MWF,
        constraintIndex: null,
      }),
    );
  });

  it('names the TBA location when it belongs to the second section', () => {
    const first = buildSection({ meetings: [mwf('09:00', '09:50', north.id)] }, 1);
    const second = buildSection({ meetings: [mwf('13:00', '13:50', null)] }, 2);

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.evidence?.scheduleIssues?.[0]).toMatchObject({
      meeting: ref(S2, '13:00', '13:50'),
    });
  });

  it('passes a campus meeting next to an online synchronous meeting', () => {
    const online = buildMeetingPattern({
      startTime: '10:00',
      endTime: '10:50',
      location: { kind: MeetingLocationKind.Online },
    });
    const first = buildSection({ meetings: [mwf('09:00', '09:50', north.id)] }, 1);
    const second = buildSection(
      { campusId: null, modality: SectionModality.OnlineSynchronous, meetings: [online] },
      2,
    );

    expect(findMeetingConflicts({ first, second, transitionPolicy: null })).toEqual(PASS);
  });

  it('lists every UNKNOWN issue in section then meeting order', () => {
    const first = buildSection(
      { meetings: [mwf('08:00', '08:50', north.id), buildTbaMeeting()] },
      1,
    );
    const second = buildSection(
      { campusId: south.id, meetings: [mwf('15:00', '15:50', south.id)] },
      2,
    );

    const check = findMeetingConflicts({ first, second, transitionPolicy: null });

    expect(check.reasonCode).toBe('TRANSITION_TIME_UNDEFINED');
    expect(check.evidence?.scheduleIssues?.map((issue) => issue.reasonCode)).toEqual([
      'TRANSITION_TIME_UNDEFINED',
      'MEETING_TIME_UNKNOWN',
    ]);
  });
});
