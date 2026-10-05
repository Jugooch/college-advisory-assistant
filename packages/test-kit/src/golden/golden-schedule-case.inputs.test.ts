/**
 * @file Tests for the scheduling golden case inputs and corpus: a malformed request or a
 *   repeated case ID is rejected for the rule it breaks.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ScheduleOutcome } from '@caa/domain';

import { buildSection } from '../builders/section.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { defineGoldenCorpus } from './golden-case.schema';
import { GoldenScheduleFamily } from './golden-schedule-case.schema';
import { scheduleCase, scheduleInputs } from './golden-schedule-factories';

const { math102, phys201, ind390 } = SYNTHETIC_COURSES;
const BOTH = [math102.id, phys201.id];
const SECTIONS = [
  buildSection({ courseId: math102.id }, 911),
  buildSection({ courseId: phys201.id }, 912),
];

/** A valid case: a search capped at one attempt times out. */
const TIMEOUT = {
  id: 'GC-SOLVE-910',
  family: GoldenScheduleFamily.SolverOutcome,
  title: 'Inputs test case',
  requirementIds: ['FR-18'],
  inputs: scheduleInputs({ requestedCourseIds: BOTH, sections: SECTIONS, workCap: 1 }),
  expected: {
    outcome: ScheduleOutcome.SearchTimeout,
    searchComplete: false,
    options: [],
    conflictSet: null,
    unresolved: [],
  },
  prohibitedClaims: [{ state: CheckState.Conditional, claim: 'never conditional' }],
  rationale: 'The first candidate needs two attempts.',
  citations: ['ADR-0010 §1'],
};

describe('scheduling golden case inputs', () => {
  it('accepts the valid case', () => {
    expect(scheduleCase(TIMEOUT).inputs.workCap).toBe(1);
  });

  it.each([
    [
      'a repeated requested course',
      { requestedCourseIds: [math102.id, math102.id] },
      /Requested courses must be distinct and in courses/,
    ],
    ['a work cap of 0', { workCap: 0 }, /"workCap"/],
    ['a work cap above 3,000,000', { workCap: 3_000_001 }, /"workCap"/],
    [
      'a credit selection for an unrequested course',
      { creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 200 }] },
      /Credit selections must name distinct requested courses/,
    ],
  ])('rejects %s', (_name, change, message) => {
    const inputs = scheduleInputs({ requestedCourseIds: BOTH, sections: SECTIONS, ...change });

    expect(() => scheduleCase({ ...TIMEOUT, inputs })).toThrow(message);
  });

  it('rejects a repeated scheduling case ID', () => {
    expect(() => defineGoldenCorpus([scheduleCase(TIMEOUT), scheduleCase(TIMEOUT)])).toThrow(
      /GC-SOLVE-910/,
    );
  });
});
