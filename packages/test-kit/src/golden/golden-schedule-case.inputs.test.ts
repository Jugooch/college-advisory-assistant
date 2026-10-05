/**
 * @file Tests for the scheduling golden case inputs, prohibited claims, and corpus: a malformed
 *   request, claim, or repeated case ID is rejected for the rule it breaks.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildAcademicPolicy } from '../builders/academic-policy.builder';
import { buildCampusTransitionPolicy } from '../builders/campus-transition-policy.builder';
import { buildMeetingPattern } from '../builders/meeting-pattern.builder';
import { buildSection } from '../builders/section.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { defineGoldenCorpus } from './golden-case.schema';
import { GoldenScheduleFamily } from './golden-schedule-case.schema';
import { scheduleCase, scheduleInputs, sectionIdsOf } from './golden-schedule-factories';

const { math102, phys201, ind390 } = SYNTHETIC_COURSES;
const BOTH = [math102.id, phys201.id];
/** DEMO-MATH 102 MWF 09:00–09:50 and DEMO-PHYS 201 TTh 09:00–09:50: one compatible candidate. */
const SECTIONS = [
  buildSection({ courseId: math102.id }, 911),
  buildSection(
    {
      courseId: phys201.id,
      meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
    },
    912,
  ),
];
const INPUTS = scheduleInputs({ requestedCourseIds: BOTH, sections: SECTIONS, workCap: 1 });

/** A valid case: a search capped at one attempt times out. */
const TIMEOUT = {
  id: 'GC-SOLVE-910',
  family: GoldenScheduleFamily.SolverOutcome,
  title: 'Inputs test case',
  requirementIds: ['FR-18'],
  inputs: INPUTS,
  expected: {
    outcome: ScheduleOutcome.SearchTimeout,
    searchComplete: false,
    options: [],
    conflictSet: null,
    unresolved: [],
  },
  prohibitedClaims: [{ state: CheckState.Conditional, claim: 'never conditional' }],
  rationale: 'The one compatible candidate needs two attempts, one per course; the cap is one.',
  citations: ['ADR-0010 §1'],
};

describe('scheduling golden case inputs', () => {
  it('accepts the valid case, with a transition table or with none', () => {
    expect(scheduleCase(TIMEOUT).inputs.workCap).toBe(1);
    expect(
      scheduleCase({ ...TIMEOUT, inputs: { ...INPUTS, transitionPolicy: null } }).inputs
        .transitionPolicy,
    ).toBeNull();
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

  it('rejects a policy or a transition table of another tenant than the snapshot', () => {
    const tenantB = SYNTHETIC_TENANTS.b.id;
    const policy = { ...INPUTS, academicPolicy: buildAcademicPolicy({ tenantId: tenantB }) };
    const table = {
      ...INPUTS,
      transitionPolicy: buildCampusTransitionPolicy({ tenantId: tenantB }),
    };
    const message = /Every source must belong to the snapshot tenant/;

    expect(() => scheduleCase({ ...TIMEOUT, inputs: policy })).toThrow(message);
    expect(() => scheduleCase({ ...TIMEOUT, inputs: table })).toThrow(message);
  });
});

describe('scheduling prohibited claims', () => {
  it('accepts a prohibited state for one option, and rejects one for an outcome', () => {
    const sectionIds = sectionIdsOf(...SECTIONS);
    const forOption = [{ state: CheckState.Pass, sectionIds, claim: 'x' }];
    const forOutcome = [{ outcome: ScheduleOutcome.NoFeasiblePlan, sectionIds, claim: 'x' }];

    expect(scheduleCase({ ...TIMEOUT, prohibitedClaims: forOption }).prohibitedClaims).toEqual(
      forOption,
    );
    expect(() => scheduleCase({ ...TIMEOUT, prohibitedClaims: forOutcome })).toThrow(
      /Only a prohibited state names an option/,
    );
  });
});

describe('defineGoldenCorpus with scheduling cases', () => {
  it('rejects a repeated scheduling case ID', () => {
    expect(() => defineGoldenCorpus([scheduleCase(TIMEOUT), scheduleCase(TIMEOUT)])).toThrow(
      /GC-SOLVE-910/,
    );
  });
});
