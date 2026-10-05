/**
 * @file Tests for the scheduling golden case format's own invariants, so a malformed scheduling
 *   oracle fails loudly instead of passing or failing an engine for the wrong reason.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildMeetingPattern } from '../builders/meeting-pattern.builder';
import { buildSection } from '../builders/section.builder';
import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { defineGoldenCorpus, PENDING_ACADEMIC_REVIEW } from './golden-case.schema';
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
const CONFLICT = scheduleCheck(CheckState.Fail, [
  { reasonCode: ReasonCode.MeetingConflict, sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF) },
]);

/** A valid authored case: two sections at the same time are infeasible. */
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
  prohibitedClaims: [{ outcome: ScheduleOutcome.SearchTimeout, claim: 'proven, not capped' }],
  rationale: 'Both only sections meet MWF 09:00–09:50 all term.',
  citations: ['ADR-0010 §5'],
};

/** The fitting pair as a PASS option. */
const PASS_OPTION = {
  sectionIds: sectionIdsOf(MATH_MWF, PHYS_TTH),
  scheduleFeasibility: SCHEDULE_PASS,
};

/** A valid authored case: the fitting pair is the one option. */
const FEASIBLE = {
  ...INFEASIBLE,
  id: 'GC-SOLVE-901',
  inputs: scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_MWF, PHYS_TTH] }),
  expected: {
    outcome: ScheduleOutcome.OptionsFound,
    searchComplete: true,
    options: [PASS_OPTION],
    conflictSet: null,
    unresolved: [],
  },
};

describe('defineGoldenScheduleCase', () => {
  it('fills in the pending reviewer, the S4 date, the sources, and no alternatives', () => {
    expect(scheduleCase(INFEASIBLE)).toMatchObject({
      reviewer: PENDING_ACADEMIC_REVIEW,
      adjudicatedOn: '2026-10-05',
      allowedAlternatives: [],
      inputs: { workCap: 3_000_000, transitionPolicy: { version: 'demo-2026.1' } },
    });
    expect(scheduleCase(FEASIBLE).expected.options).toHaveLength(1);
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
        ...FEASIBLE.expected,
        options: [],
        outcome: ScheduleOutcome.NeedsVerification,
        searchComplete: false,
      },
    ],
  ])('rejects %s', (_name, expected) => {
    expect(() => scheduleCase({ ...INFEASIBLE, expected })).toThrow();
  });

  it('rejects an UNKNOWN option ranked above a PASS one, and a repeated option', () => {
    const unknown = {
      sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF),
      scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
        { reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: sectionIdsOf(PHYS_MWF) },
      ]),
    };
    const pass = PASS_OPTION;
    const inputs = scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_MWF, PHYS_MWF, PHYS_TTH],
    });
    const ranked = (options: typeof FEASIBLE.expected.options): typeof FEASIBLE => ({
      ...FEASIBLE,
      inputs,
      expected: { ...FEASIBLE.expected, options },
    });

    expect(() => scheduleCase(ranked([unknown, pass]))).toThrow();
    expect(() => scheduleCase(ranked([pass, pass]))).toThrow();
    expect(scheduleCase(ranked([pass, unknown])).expected.options).toHaveLength(2);
  });

  it('rejects an option whose schedule check is FAIL', () => {
    const options = [
      { sectionIds: sectionIdsOf(MATH_MWF, PHYS_MWF), scheduleFeasibility: CONFLICT },
    ];

    expect(() =>
      scheduleCase({ ...FEASIBLE, expected: { ...FEASIBLE.expected, options } }),
    ).toThrow();
  });

  it.each([
    [
      'a FAIL explained by an UNKNOWN reason',
      ReasonCode.TransitionTimeUndefined,
      [MATH_MWF, PHYS_MWF],
    ],
    ['unsorted section IDs', ReasonCode.MeetingConflict, [PHYS_MWF, MATH_MWF]],
  ])('rejects a conflict with %s', (_name, reasonCode, sections) => {
    const item = {
      check: { kind: CheckKind.ScheduleFeasibility, state: CheckState.Fail, reasonCode },
      issues: [{ reasonCode, sectionIds: sections.map((section) => section.id) }],
    };
    const conflictSet = { items: [item], omittedCount: 0 };

    expect(() =>
      scheduleCase({ ...INFEASIBLE, expected: { ...INFEASIBLE.expected, conflictSet } }),
    ).toThrow();
  });

  it('rejects a PASS with issues, and missing section data that names no course', () => {
    const passWithIssue = { ...SCHEDULE_PASS, issues: CONFLICT.issues };
    const missing = {
      check: {
        kind: CheckKind.ScheduleFeasibility,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.SectionDataMissing,
      },
      issues: [{ reasonCode: ReasonCode.SectionDataMissing, sectionIds: [] }],
    };
    const options = [{ ...PASS_OPTION, scheduleFeasibility: passWithIssue }];

    expect(() =>
      scheduleCase({ ...FEASIBLE, expected: { ...FEASIBLE.expected, options } }),
    ).toThrow();
    expect(() =>
      scheduleCase({
        ...FEASIBLE,
        expected: {
          ...FEASIBLE.expected,
          options: [],
          outcome: ScheduleOutcome.NeedsVerification,
          searchComplete: false,
          unresolved: [missing],
        },
      }),
    ).toThrow();
  });

  it('rejects an expectation that makes a claim the case prohibits', () => {
    const prohibitOutcome = [{ outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'x' }];
    const prohibitPass = [
      { state: CheckState.Pass, sectionIds: sectionIdsOf(MATH_MWF, PHYS_TTH), claim: 'x' },
    ];

    expect(() => scheduleCase({ ...INFEASIBLE, prohibitedClaims: prohibitOutcome })).toThrow();
    expect(() => scheduleCase({ ...FEASIBLE, prohibitedClaims: prohibitPass })).toThrow();
    expect(() =>
      scheduleCase({
        ...FEASIBLE,
        prohibitedClaims: [
          { outcome: ScheduleOutcome.SearchTimeout, state: CheckState.Fail, claim: 'x' },
        ],
      }),
    ).toThrow();
  });

  it('rejects an option made of a section the snapshot does not publish', () => {
    const inputs = scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_MWF, PHYS_MWF] });

    expect(() => scheduleCase({ ...FEASIBLE, inputs })).toThrow();
  });

  it.each([
    ['a repeated requested course', { requestedCourseIds: [math102.id, math102.id] }],
    ['a work cap of 0', { workCap: 0 }],
    ['a work cap above 3,000,000', { workCap: 3_000_001 }],
    [
      'a credit selection for an unrequested course',
      {
        creditSelections: [
          { courseId: SYNTHETIC_COURSES.ind390.id, selectedCreditsHundredths: 200 },
        ],
      },
    ],
  ])('rejects inputs with %s', (_name, change) => {
    const inputs = scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_MWF, PHYS_MWF],
      ...change,
    });

    expect(() => scheduleCase({ ...INFEASIBLE, inputs })).toThrow();
  });
});

describe('defineGoldenCorpus with scheduling cases', () => {
  it('rejects a repeated scheduling case ID', () => {
    expect(() => defineGoldenCorpus([scheduleCase(INFEASIBLE), scheduleCase(INFEASIBLE)])).toThrow(
      /GC-SOLVE-900/,
    );
  });
});
