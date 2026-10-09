/**
 * @file Golden scheduling cases: a chosen variable credit inside a bundle, against the term
 *   bounds (#226, AC18). GC-SOLVE-015–020.
 * @module @caa/test-kit/golden/cases/solver-credit-selection
 * @requirement FR-06
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import type { ExpectedCheckInput } from '../golden-expectation.schema';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase, GoldenScheduleCaseInput } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math102, ind390 } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.SolverOutcome;
const REQUIREMENTS = ['FR-06', 'FR-07', 'FR-18', 'AC18', 'T05'];
const CITATIONS = ['planning/13 AC18', 'ADR-0010 §3', 'issue #57 (credit-load reasons)'];

/** DEMO-MATH 102, 3.00 credits, MWF 09:00–09:50. */
const FIXED = scheduleSection(math102.id, 3701);
/** DEMO-IND 390, 1.00 to 3.00 credits, TTh 09:00–09:50: apart from FIXED. */
const VARIABLE = scheduleSection(ind390.id, 3702, {
  meeting: { weekdays: [Weekday.Tuesday, Weekday.Thursday] },
});

/**
 * Builds the solver inputs: the fixed and the variable course, and the bounds and choice that
 * each case varies.
 *
 * @param bounds - Term credit bounds in hundredths.
 * @param selected - The chosen credits of DEMO-IND 390 in hundredths, or `null` for none.
 * @returns The inputs.
 */
function inputsFor(
  bounds: { readonly min: number; readonly max: number },
  selected: number | null,
): ReturnType<typeof scheduleInputs> {
  return scheduleInputs({
    requestedCourseIds: [math102.id, ind390.id],
    sections: [FIXED, VARIABLE],
    creditBounds: { minCreditsHundredths: bounds.min, maxCreditsHundredths: bounds.max },
    creditSelections:
      selected === null ? [] : [{ courseId: ind390.id, selectedCreditsHundredths: selected }],
  });
}

/**
 * Builds the CREDIT_LOAD check for a decided load.
 *
 * @param state - PASS or FAIL.
 * @param reasonCode - The reason; `null` for PASS.
 * @param load - The total and the bounds, in hundredths.
 * @returns The expected check.
 */
function loadCheck(
  state: CheckState,
  reasonCode: ReasonCode | null,
  load: { readonly total: number; readonly min: number; readonly max: number },
): ExpectedCheckInput {
  return {
    kind: CheckKind.CreditLoad,
    state,
    reasonCode,
    evidence: {
      creditLoad: {
        totalCreditsHundredths: load.total,
        minCreditsHundredths: load.min,
        maxCreditsHundredths: load.max,
      },
    },
  };
}

/**
 * Expects one option of both sections that passes with the given load.
 *
 * @param load - The total and the bounds, in hundredths.
 * @returns The expectation.
 */
function expectPassingLoad(load: {
  readonly total: number;
  readonly min: number;
  readonly max: number;
}): GoldenScheduleCaseInput['expected'] {
  return {
    outcome: ScheduleOutcome.OptionsFound,
    searchComplete: true,
    options: [
      {
        sectionIds: sectionIdsOf(FIXED, VARIABLE),
        scheduleFeasibility: SCHEDULE_PASS,
        creditLoad: loadCheck(CheckState.Pass, null, load),
      },
    ],
    conflictSet: null,
    unresolved: [],
  };
}

const NOT_OFFERED = {
  outcome: ScheduleOutcome.OptionsFound,
  claim: 'a load outside the term bounds is never offered',
};

/** Chosen-credit cases. */
export const SOLVER_CREDIT_SELECTION_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-SOLVE-015',
    family: FAMILY,
    title: 'A chosen 2.00 credits is counted exactly in the bundle',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 100, max: 1800 }, 200),
    expected: expectPassingLoad({ total: 500, min: 100, max: 1800 }),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a chosen value inside the bounds is never infeasible',
      },
    ],
    rationale:
      '3.00 (DEMO-MATH 102) + 2.00 (the chosen value, not the 1.00 minimum, the 3.00 maximum or a default) = 5.00, inside 1.00 to 18.00.',
    citations: CITATIONS,
  }),
  scheduleCase({
    id: 'GC-SOLVE-016',
    family: FAMILY,
    title: 'A chosen value that makes the load exactly the maximum passes',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 100, max: 500 }, 200),
    expected: expectPassingLoad({ total: 500, min: 100, max: 500 }),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a load equal to the inclusive maximum is within the bounds',
      },
    ],
    rationale: '3.00 + 2.00 = 5.00 equals the 5.00 maximum, which is inclusive.',
    citations: CITATIONS,
  }),
  scheduleCase({
    id: 'GC-SOLVE-017',
    family: FAMILY,
    title: 'A chosen value that puts the load 0.50 over the maximum has no plan',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 100, max: 500 }, 250),
    expected: expectNoPlan([
      {
        check: loadCheck(CheckState.Fail, ReasonCode.CreditLimitExceeded, {
          total: 550,
          min: 100,
          max: 500,
        }),
        issues: [],
      },
    ]),
    prohibitedClaims: [NOT_OFFERED],
    rationale:
      '3.00 + 2.50 = 5.50 is over the 5.00 maximum. The load is a hard rule, so the only bundle set is removed and the search proves no plan.',
    citations: CITATIONS,
  }),
  scheduleCase({
    id: 'GC-SOLVE-018',
    family: FAMILY,
    title: 'A chosen course minimum that makes the load exactly the term minimum passes',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 400, max: 1800 }, 100),
    expected: expectPassingLoad({ total: 400, min: 400, max: 1800 }),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a load equal to the inclusive minimum is within the bounds',
      },
    ],
    rationale:
      '3.00 + 1.00, the course minimum, = 4.00 equals the 4.00 term minimum, which is inclusive.',
    citations: CITATIONS,
  }),
  scheduleCase({
    id: 'GC-SOLVE-019',
    family: FAMILY,
    title: 'A chosen value that leaves the load 0.50 under the minimum has no plan',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 450, max: 1800 }, 100),
    expected: expectNoPlan([
      {
        check: loadCheck(CheckState.Fail, ReasonCode.CreditBelowMinimum, {
          total: 400,
          min: 450,
          max: 1800,
        }),
        issues: [],
      },
    ]),
    prohibitedClaims: [NOT_OFFERED],
    rationale:
      '3.00 + 1.00 = 4.00 is under the 4.50 minimum, a hard rule, so the only bundle set is removed.',
    citations: CITATIONS,
  }),
  scheduleCase({
    id: 'GC-SOLVE-020',
    family: FAMILY,
    title: 'An unchosen value that straddles the minimum leaves the option UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: inputsFor({ min: 500, max: 1800 }, null),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(FIXED, VARIABLE),
          scheduleFeasibility: {
            check: {
              kind: CheckKind.ScheduleFeasibility,
              state: CheckState.Unknown,
              reasonCode: ReasonCode.VariableCreditUnselected,
            },
            issues: [],
          },
          creditLoad: {
            kind: CheckKind.CreditLoad,
            state: CheckState.Unknown,
            reasonCode: ReasonCode.VariableCreditUnselected,
            evidence: { courseIds: [ind390.id], creditLoad: null },
          },
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        claim: 'an unchosen credit value is never assumed, so the option is never PASS',
      },
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a load that could fit is never reported as infeasible',
      },
    ],
    rationale:
      'DEMO-IND 390 carries 1.00 to 3.00 credits and none is chosen, so the load is 4.00 to 6.00 against a 5.00 minimum: some values fit and some do not. The load is UNKNOWN, which keeps the option as UNKNOWN, never PASS.',
    citations: [...CITATIONS, 'planning/13 AC29 (an unchosen credit is UNKNOWN)'],
  }),
];
