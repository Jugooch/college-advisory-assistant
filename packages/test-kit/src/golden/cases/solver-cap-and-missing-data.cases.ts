/**
 * @file Golden scheduling cases: the bounded search and missing data (#220, AC12). GC-SOLVE-002 to -004, -008 and -009.
 * @module @caa/test-kit/golden/cases/solver-cap-and-missing-data
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildUnavailableTime, HARD_STRENGTH } from '../../builders/schedule-constraint.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  expectOneOption,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, math102 } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.SolverOutcome;
const REQUIREMENTS = ['FR-07', 'FR-18', 'T05'];
const CAP_REQUIREMENTS = ['FR-18', 'NFR-07', 'AC12', 'T05'];
const TTH = [Weekday.Tuesday, Weekday.Thursday];
const NO_FRIDAYS = { weekdays: [Weekday.Friday], startTime: '00:00', endTime: '24:00' };

// NOTE: course A is DEMO-MATH 101 and course B is DEMO-MATH 102. A's ID sorts first, so the
// search tries A first. Section seeds ascend in the order the sections are named.

/** Course A, MWF 09:00–09:50. */
const A1 = scheduleSection(math101.id, 3401);

// NOTE: the cap cases use sections that never conflict: A MWF 09:00 and 11:00, B TTh 09:00 and 11:00.
const CA1 = scheduleSection(math101.id, 3411);
const CA2 = scheduleSection(math101.id, 3412, {
  meeting: { startTime: '11:00', endTime: '11:50' },
});
const CB1 = scheduleSection(math102.id, 3413, { meeting: { weekdays: TTH } });
const CB2 = scheduleSection(math102.id, 3414, {
  meeting: { weekdays: TTH, startTime: '11:00', endTime: '11:50' },
});

/** A course A section and a course B section on different weekdays, one bundle each. */
const ONE_A = scheduleSection(math101.id, 3421);
const ONE_B = scheduleSection(math102.id, 3422, { meeting: { weekdays: TTH } });

/** Solver outcome cases. */
export const SOLVER_CAP_AND_MISSING_DATA_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-SOLVE-002',
    family: FAMILY,
    title: 'A cap of one attempt for two courses times out and never says infeasible',
    requirementIds: CAP_REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [ONE_A, ONE_B],
      workCap: 1,
    }),
    expected: {
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a capped search is never reported as infeasible (AC12)',
      },
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'no candidate was found within the cap',
      },
    ],
    rationale:
      'Each course has one bundle, so the first candidate needs two attempts. The cap allows one, so the search stops with no candidate: a timeout.',
    citations: ['planning/13 AC12', 'ADR-0010 §1 and §5'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-003',
    family: FAMILY,
    title: 'A search that needs exactly the cap is complete',
    requirementIds: CAP_REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [ONE_A, ONE_B],
      workCap: 2,
    }),
    expected: expectOneOption(sectionIdsOf(ONE_A, ONE_B)),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.SearchTimeout,
        claim: 'a search that needs exactly the cap is complete (ADR-0010 §1)',
      },
    ],
    rationale:
      'Two attempts are needed and the cap is two, so the search finishes with one option.',
    citations: ['ADR-0010 §1'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-004',
    family: FAMILY,
    title: 'A cap reached after the first candidate returns it as incomplete',
    requirementIds: CAP_REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [CA1, CA2, CB1, CB2],
      workCap: 2,
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: false,
      options: [{ sectionIds: sectionIdsOf(CA1, CB1), scheduleFeasibility: SCHEDULE_PASS }],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a capped search never proves infeasibility',
      },
    ],
    rationale:
      'Two attempts reach the first candidate {A1, B1}, and a third is needed to go on. The result says the search is incomplete, so it claims neither best nor only.',
    citations: ['ADR-0010 §1 and §5'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-008',
    family: FAMILY,
    title: 'A requested course with no section in the snapshot needs verification',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [ONE_B],
    }),
    expected: {
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [
        scheduleCheck(CheckState.Unknown, [
          { reasonCode: ReasonCode.SectionDataMissing, sectionIds: [], courseId: math101.id },
        ]),
      ],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a course with no published section is never dropped from the plan',
      },
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'missing data is UNKNOWN, not a verified conflict',
      },
    ],
    rationale:
      'DEMO-MATH 101 has no section in the snapshot, which is missing data. The search does not run.',
    citations: ['ADR-0010 §5 and §6'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-009',
    family: FAMILY,
    title: 'A proven violation outranks missing data in another course',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [A1],
      constraints: [buildUnavailableTime({ ...HARD_STRENGTH, ...NO_FRIDAYS })],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.UnavailableTimeConflict,
          sectionIds: sectionIdsOf(A1),
          constraintIndex: 0,
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NeedsVerification,
        claim: 'FAIL takes precedence over UNKNOWN (ADR-0010 §5)',
      },
    ],
    rationale:
      'DEMO-MATH 101’s only section meets on Friday, which the hard rule forbids, so that course has no bundle on known data. DEMO-MATH 102 has no section. FAIL precedes UNKNOWN.',
    citations: ['ADR-0010 §5 (precedence before the search)'],
  }),
];
