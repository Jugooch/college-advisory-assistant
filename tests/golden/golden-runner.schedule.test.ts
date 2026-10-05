/**
 * @file Proves the golden runner compares a meeting-conflict case's schedule issues on the facts
 *   the case states, and reports a wrong section, date, or minute count with the case ID and
 *   field, so a scheduling case can't pass on the state alone.
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, MeetingLocationKind, ReasonCode, Weekday } from '@caa/domain';
import {
  buildCampusTransition,
  GoldenScheduleFamily,
  meetingCheck,
  meetingConflictCase,
  meetingInputs,
  mustNot,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { findGoldenMismatches } from '../support/golden-runner';

const { math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
/** North MWF 09:00–09:50, then south MWF 10:00–10:50: a 10-minute gap. */
const NORTH = scheduleSection(math102.id, 2901);
const SOUTH = scheduleSection(phys201.id, 2902, {
  meeting: {
    startTime: '10:00',
    endTime: '10:50',
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { campusId: south.id },
});

/**
 * Builds a case expecting a north→south shortfall with the given facts.
 *
 * @param facts - The minutes and shared weekdays the case states.
 * @param facts.availableMinutes - The gap the case states.
 * @param facts.weekdays - The shared weekdays the case states.
 * @returns The case.
 */
function travelCase(facts: {
  availableMinutes: number;
  weekdays: readonly Weekday[];
}): ReturnType<typeof meetingConflictCase> {
  return meetingConflictCase({
    id: 'GC-TRAVEL-900',
    family: GoldenScheduleFamily.TransitionTime,
    title: 'Runner test case',
    requirementIds: ['FR-07'],
    inputs: meetingInputs(NORTH, SOUTH, [buildCampusTransition(north.id, south.id, 15)]),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.TransitionTimeInsufficient,
          sectionIds: sectionIdsOf(NORTH, SOUTH),
          fromCampusId: north.id,
          toCampusId: south.id,
          requiredMinutes: 15,
          availableMinutes: facts.availableMinutes,
          sharedDates: {
            firstDate: '2027-01-11',
            lastDate: '2027-05-07',
            weekdays: facts.weekdays,
          },
        },
      ]),
    ],
    prohibitedClaims: [mustNot(CheckState.Pass, 'x')],
    rationale: '10 minutes where 15 are required.',
    citations: ['ADR-0010 §8'],
  });
}

const MWF = [Weekday.Friday, Weekday.Monday, Weekday.Wednesday];

describe('findGoldenMismatches on schedule issues', () => {
  it('passes when every stated fact matches, with weekdays compared as a sorted set', () => {
    expect(findGoldenMismatches(travelCase({ availableMinutes: 10, weekdays: MWF }))).toEqual([]);
  });

  it('names the case and the issue field when a stated fact differs', () => {
    const mismatches = findGoldenMismatches(travelCase({ availableMinutes: 11, weekdays: MWF }));

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^GC-TRAVEL-900 checks\[0\]\.evidence\.scheduleIssues: /);
    expect(mismatches[0]).toContain('"availableMinutes":11');
  });
});
