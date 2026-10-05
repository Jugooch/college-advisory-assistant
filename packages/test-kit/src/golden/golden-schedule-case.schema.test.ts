/**
 * @file Tests for the scheduling golden case format's own invariants, so a malformed scheduling
 *   oracle fails loudly instead of passing or failing an engine for the wrong reason. Each
 *   rejection starts from a valid case, breaks one rule, and asserts that rule's message.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildMeetingPattern } from '../builders/meeting-pattern.builder';
import { buildSection } from '../builders/section.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { PENDING_ACADEMIC_REVIEW } from './golden-case.schema';
import { GoldenScheduleFamily } from './golden-schedule-case.schema';
import {
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  sectionIdsOf,
} from './golden-schedule-factories';

const { math102, phys201 } = SYNTHETIC_COURSES;
/** DEMO-MATH 102, MWF 09:00–09:50. */
const MATH_MWF = buildSection({ courseId: math102.id }, 901);
/** DEMO-PHYS 201, MWF 09:00–09:50: conflicts with {@link MATH_MWF}. */
const PHYS_MWF = buildSection({ courseId: phys201.id }, 902);
/** DEMO-PHYS 201, TTh 09:00–09:50: fits with {@link MATH_MWF}. */
const PHYS_TTH = buildSection(
  {
    courseId: phys201.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  903,
);
const BOTH = [math102.id, phys201.id];
/** All three sections, so any option over them is published. */
const ALL_INPUTS = scheduleInputs({
  requestedCourseIds: BOTH,
  sections: [MATH_MWF, PHYS_MWF, PHYS_TTH],
});
const CONFLICT = scheduleCheck(CheckState.Fail, [
  { reasonCode: ReasonCode.MeetingConflict, sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF) },
]);
/** A prohibited claim no expectation below makes: no schedule check is CONDITIONAL. */
const NEUTRAL_CLAIMS = [{ state: CheckState.Conditional, claim: 'never conditional' }];

/** A valid authored case: the two only sections meet at the same time, so no plan exists. */
const INFEASIBLE = {
  id: 'GC-SOLVE-900',
  family: GoldenScheduleFamily.SolverOutcome,
  title: 'Schema test case',
  requirementIds: ['FR-18'],
  inputs: scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_MWF, PHYS_MWF] }),
  expected: {
    outcome: ScheduleOutcome.NoFeasiblePlan,
    searchComplete: true,
    options: [],
    conflictSet: { items: [CONFLICT], omittedCount: 0 },
    unresolved: [],
  },
  prohibitedClaims: NEUTRAL_CLAIMS,
  rationale: 'Each course has one section, and both meet MWF 09:00–09:50 all term.',
  citations: ['ADR-0010 §5'],
};

/** The fitting pair as a PASS option. */
const PASS_OPTION = {
  sectionIds: sectionIdsOf(MATH_MWF, PHYS_TTH),
  scheduleFeasibility: SCHEDULE_PASS,
};

/** A valid authored case over all three sections: the fitting pair is the one option. */
const FEASIBLE = {
  ...INFEASIBLE,
  id: 'GC-SOLVE-901',
  inputs: ALL_INPUTS,
  expected: {
    outcome: ScheduleOutcome.OptionsFound,
    searchComplete: true,
    options: [PASS_OPTION],
    conflictSet: null,
    unresolved: [],
  },
};

/** An UNKNOWN option over the conflicting pair, for ranking rows. */
const UNKNOWN_OPTION = {
  sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF),
  scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
    { reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: sectionIdsOf(PHYS_MWF) },
  ]),
};

const OUTCOME_SHAPE = /searchComplete, options, conflictSet and unresolved must match the outcome/;

/**
 * Builds {@link FEASIBLE} with other options.
 *
 * @param options - The options, best first.
 * @returns The case.
 */
function withOptions(options: (typeof FEASIBLE)['expected']['options']): typeof FEASIBLE {
  return { ...FEASIBLE, expected: { ...FEASIBLE.expected, options } };
}

describe('defineGoldenScheduleCase', () => {
  it('fills in the pending reviewer, the S4 date, the sources, and no alternatives', () => {
    expect(scheduleCase(INFEASIBLE)).toMatchObject({
      reviewer: PENDING_ACADEMIC_REVIEW,
      adjudicatedOn: '2026-10-05',
      allowedAlternatives: [],
      inputs: { workCap: 3_000_000, transitionPolicy: { version: 'demo-2026.1' } },
    });
    expect(scheduleCase(FEASIBLE).expected.options).toHaveLength(1);
    expect(scheduleCase(withOptions([PASS_OPTION, UNKNOWN_OPTION])).expected.options).toHaveLength(
      2,
    );
  });

  it.each([
    ['NO_FEASIBLE_PLAN without a conflict set', { ...INFEASIBLE.expected, conflictSet: null }],
    ['NO_FEASIBLE_PLAN on an incomplete search', { ...INFEASIBLE.expected, searchComplete: false }],
    [
      'SEARCH_TIMEOUT with a conflict set',
      { ...INFEASIBLE.expected, outcome: ScheduleOutcome.SearchTimeout, searchComplete: false },
    ],
    ['OPTIONS_FOUND with no option', { ...FEASIBLE.expected, options: [] }],
    [
      'NEEDS_VERIFICATION with nothing unresolved',
      {
        ...INFEASIBLE.expected,
        outcome: ScheduleOutcome.NeedsVerification,
        searchComplete: false,
        conflictSet: null,
      },
    ],
  ])('rejects %s on the outcome shape', (_name, expected) => {
    expect(() => scheduleCase({ ...FEASIBLE, expected })).toThrow(OUTCOME_SHAPE);
  });

  it('rejects an UNKNOWN option above a PASS one, and a repeated option', () => {
    const ranking = /Options must be distinct, with PASS schedules first/;

    expect(() => scheduleCase(withOptions([UNKNOWN_OPTION, PASS_OPTION]))).toThrow(ranking);
    expect(() => scheduleCase(withOptions([PASS_OPTION, PASS_OPTION]))).toThrow(ranking);
  });

  it('rejects an option whose schedule check is FAIL', () => {
    const failing = { sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF), scheduleFeasibility: CONFLICT };

    expect(() => scheduleCase(withOptions([failing]))).toThrow(
      /An option is a PASS or UNKNOWN schedule check/,
    );
  });

  it('rejects an option whose credit load is FAIL, or UNKNOWN under a PASS schedule', () => {
    const load = (
      state: CheckState,
      reasonCode: ReasonCode,
    ): Parameters<typeof scheduleCase>[0] => ({
      ...FEASIBLE,
      expected: {
        ...FEASIBLE.expected,
        options: [
          { ...PASS_OPTION, creditLoad: { kind: CheckKind.CreditLoad, state, reasonCode } },
        ],
      },
    });

    expect(() => scheduleCase(load(CheckState.Fail, ReasonCode.CreditLimitExceeded))).toThrow(
      /An option never has a FAIL or CONDITIONAL creditLoad/,
    );
    expect(() =>
      scheduleCase(load(CheckState.Unknown, ReasonCode.VariableCreditUnselected)),
    ).toThrow(/An UNKNOWN creditLoad requires an UNKNOWN scheduleFeasibility/);
  });

  it('rejects an option that leaves out a requested course', () => {
    expect(() =>
      scheduleCase(withOptions([{ ...PASS_OPTION, sectionIds: sectionIdsOf(MATH_MWF) }])),
    ).toThrow(/Every option must schedule each requested course once/);
  });

  it('rejects an option made of a section the snapshot does not publish', () => {
    const inputs = scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_MWF, PHYS_MWF] });

    expect(() => scheduleCase({ ...FEASIBLE, inputs })).toThrow(
      /Expected options must use published sections/,
    );
  });

  it('rejects a repeated conflict-set item', () => {
    const conflictSet = { items: [CONFLICT, CONFLICT], omittedCount: 0 };

    expect(() =>
      scheduleCase({ ...INFEASIBLE, expected: { ...INFEASIBLE.expected, conflictSet } }),
    ).toThrow(/conflictSet items must be distinct/);
  });

  it.each([
    [
      /A non-PASS schedule check has issues that mean its state and include its reason/,
      {
        reasonCode: ReasonCode.TransitionTimeUndefined,
        sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF),
      },
    ],
    [
      /sectionIds must be distinct and ascending/,
      { reasonCode: ReasonCode.MeetingConflict, sectionIds: [PHYS_MWF.id, MATH_MWF.id] },
    ],
  ])('rejects a FAIL conflict whose issue breaks %s', (message, issue) => {
    const item = { check: CONFLICT.check, issues: [issue] };
    const conflictSet = { items: [item], omittedCount: 0 };

    expect(() =>
      scheduleCase({ ...INFEASIBLE, expected: { ...INFEASIBLE.expected, conflictSet } }),
    ).toThrow(message);
  });

  it('rejects a PASS with issues', () => {
    const passWithIssue = { ...SCHEDULE_PASS, issues: CONFLICT.issues };

    expect(() =>
      scheduleCase(withOptions([{ ...PASS_OPTION, scheduleFeasibility: passWithIssue }])),
    ).toThrow(/A non-PASS schedule check has issues that mean its state and include its reason/);
  });

  it('rejects missing section data that names no course', () => {
    const missing = scheduleCheck(CheckState.Unknown, [
      { reasonCode: ReasonCode.SectionDataMissing, sectionIds: [] },
    ]);
    const expected = {
      ...FEASIBLE.expected,
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      options: [],
      unresolved: [missing],
    };

    expect(() => scheduleCase({ ...FEASIBLE, expected })).toThrow(
      /A missing section or link names its course/,
    );
  });

  it('rejects an expectation that makes an outcome or state claim the case prohibits', () => {
    const prohibited = /An accepted result must not make a prohibited claim/;
    const outcomeClaim = [{ outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'x' }];
    const passClaim = [{ state: CheckState.Pass, sectionIds: PASS_OPTION.sectionIds, claim: 'x' }];

    expect(() => scheduleCase({ ...INFEASIBLE, prohibitedClaims: outcomeClaim })).toThrow(
      prohibited,
    );
    expect(() => scheduleCase({ ...FEASIBLE, prohibitedClaims: passClaim })).toThrow(prohibited);
  });

  it('rejects a prohibited claim naming both an outcome and a state', () => {
    const both = [{ outcome: ScheduleOutcome.SearchTimeout, state: CheckState.Fail, claim: 'x' }];

    expect(() => scheduleCase({ ...FEASIBLE, prohibitedClaims: both })).toThrow(
      /A prohibited claim names an outcome or a state, not both/,
    );
  });

  it('rejects a prohibited claim whose sections are not ascending', () => {
    const reversed = [...PASS_OPTION.sectionIds].reverse();
    const claims = [{ state: CheckState.Pass, sectionIds: reversed, claim: 'x' }];

    expect(() => scheduleCase({ ...FEASIBLE, prohibitedClaims: claims })).toThrow(
      /A prohibited claim names its sections distinct and ascending/,
    );
  });
});
