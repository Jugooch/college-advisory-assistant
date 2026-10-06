/**
 * @file Proves the scheduling golden runner reports a wrong outcome, option set, state, or
 *   prohibited claim with the case ID and field, and accepts an adjudicated alternative, so a
 *   scheduling case can't pass on the outcome alone.
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { ScheduleOutcome } from '@caa/domain';
import {
  expectOneOption,
  GoldenScheduleFamily,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { findScheduleMismatches } from '../support/golden-schedule-runner';

const { math102 } = SYNTHETIC_COURSES;
const FIRST = scheduleSection(math102.id, 3901);
const SECOND = scheduleSection(math102.id, 3902);
const INPUTS = scheduleInputs({ requestedCourseIds: [math102.id], sections: [FIRST, SECOND] });
const FIRST_AND_SECOND = {
  outcome: ScheduleOutcome.OptionsFound,
  searchComplete: true,
  options: [
    { sectionIds: sectionIdsOf(FIRST), scheduleFeasibility: SCHEDULE_PASS },
    { sectionIds: sectionIdsOf(SECOND), scheduleFeasibility: SCHEDULE_PASS },
  ],
  conflictSet: null,
  unresolved: [],
};

/**
 * Builds a case over two interchangeable sections.
 *
 * @param overrides - What the test changes.
 * @returns The case.
 */
function runnerCase(
  overrides: Partial<Parameters<typeof scheduleCase>[0]>,
): ReturnType<typeof scheduleCase> {
  return scheduleCase({
    id: 'GC-SOLVE-900',
    family: GoldenScheduleFamily.SolverOutcome,
    title: 'Runner test case',
    requirementIds: ['FR-18'],
    inputs: INPUTS,
    expected: FIRST_AND_SECOND,
    prohibitedClaims: [{ outcome: ScheduleOutcome.SearchTimeout, claim: 'x' }],
    rationale: 'Two interchangeable sections give two options, lowest ID first.',
    citations: ['ADR-0010 §4'],
    ...overrides,
  });
}

describe('findScheduleMismatches', () => {
  it('accepts an answer that matches', () => {
    expect(findScheduleMismatches(runnerCase({}))).toEqual([]);
  });

  it('names the case and the field when the options differ', () => {
    const mismatches = findScheduleMismatches(
      runnerCase({ expected: expectOneOption(sectionIdsOf(FIRST)) }),
    );

    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.every((message) => message.startsWith('GC-SOLVE-900 '))).toBe(true);
    expect(mismatches.join('\n')).toContain('options.sectionIds');
  });

  it('reports a prohibited outcome the answer makes', () => {
    const mismatches = findScheduleMismatches(
      runnerCase({
        prohibitedClaims: [{ outcome: ScheduleOutcome.OptionsFound, claim: 'never offered' }],
        expected: {
          outcome: ScheduleOutcome.SearchTimeout,
          searchComplete: false,
          options: [],
          conflictSet: null,
          unresolved: [],
        },
      }),
    );

    expect(mismatches.join('\n')).toContain('prohibited OPTIONS_FOUND: never offered');
  });

  it('accepts an allowed alternative when the primary expectation differs', () => {
    const mismatches = findScheduleMismatches(
      runnerCase({
        expected: expectOneOption(sectionIdsOf(FIRST)),
        allowedAlternatives: [FIRST_AND_SECOND],
      }),
    );

    expect(mismatches).toEqual([]);
  });
});
