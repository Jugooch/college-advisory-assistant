/**
 * @file Golden scheduling cases: the solver's options, its ranking and its determinism, and a proven conflict (#220). GC-SOLVE-001, -005, -006, -007 and -010.
 * @module @caa/test-kit/golden/cases/solver-outcome
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, MeetingLocationKind, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, math102 } = SYNTHETIC_COURSES;
const { south } = SYNTHETIC_CAMPUSES;
const FAMILY = GoldenScheduleFamily.SolverOutcome;
const REQUIREMENTS = ['FR-07', 'FR-18', 'T05'];
const TTH = [Weekday.Tuesday, Weekday.Thursday];

// NOTE: course A is DEMO-MATH 101 and course B is DEMO-MATH 102. A's ID sorts first, so the
// search tries A first. Section seeds ascend in the order the sections are named.

/** Course A, MWF 09:00–09:50. */
const A1 = scheduleSection(math101.id, 3401);
/** Course A, TTh 09:00–09:50: conflicts with B2 when both are in play. */
const A2 = scheduleSection(math101.id, 3402, { meeting: { weekdays: TTH } });
/** Course B, MWF 09:00–09:50: conflicts with A1. */
const B1 = scheduleSection(math102.id, 3403);
/** Course B, TTh 09:00–09:50: conflicts with A2. */
const B2 = scheduleSection(math102.id, 3404, { meeting: { weekdays: TTH } });

// NOTE: the cap cases use sections that never conflict: A MWF 09:00 and 11:00, B TTh 09:00 and 11:00.
const CA1 = scheduleSection(math101.id, 3411);
const CA2 = scheduleSection(math101.id, 3412, {
  meeting: { startTime: '11:00', endTime: '11:50' },
});
const CB1 = scheduleSection(math102.id, 3413, { meeting: { weekdays: TTH } });
const CB2 = scheduleSection(math102.id, 3414, {
  meeting: { weekdays: TTH, startTime: '11:00', endTime: '11:50' },
});

/** A single section of each course, both MWF 09:00–09:50. */
const SAME_A = scheduleSection(math101.id, 3431);
const SAME_B = scheduleSection(math102.id, 3432);

/** North course A section, then course B on north and on south, MWF 10:00–10:50. */
const NORTH_A = scheduleSection(math101.id, 3441);
const NORTH_B = scheduleSection(math102.id, 3442, {
  meeting: { startTime: '10:00', endTime: '10:50' },
});
const SOUTH_B = scheduleSection(math102.id, 3443, {
  meeting: {
    startTime: '10:00',
    endTime: '10:50',
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { campusId: south.id },
});

/** The two compatible bundles per course, so four candidate sets. */
const FOUR_SETS = scheduleInputs({
  requestedCourseIds: [math101.id, math102.id],
  sections: [CA1, CA2, CB1, CB2],
});
const TOP_THREE = [
  { sectionIds: sectionIdsOf(CA1, CB1), scheduleFeasibility: SCHEDULE_PASS },
  { sectionIds: sectionIdsOf(CA1, CB2), scheduleFeasibility: SCHEDULE_PASS },
  { sectionIds: sectionIdsOf(CA2, CB1), scheduleFeasibility: SCHEDULE_PASS },
];

/** Solver outcome cases. */
export const SOLVER_OUTCOME_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-SOLVE-001',
    family: FAMILY,
    title: 'Two courses with two sections each give the two conflict-free options',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [A1, A2, B1, B2],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        { sectionIds: sectionIdsOf(A1, B2), scheduleFeasibility: SCHEDULE_PASS },
        { sectionIds: sectionIdsOf(A2, B1), scheduleFeasibility: SCHEDULE_PASS },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(A1, B1),
        claim: 'two sections at the same time are never an option',
      },
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(A2, B2),
        claim: 'two sections at the same time are never an option',
      },
    ],
    rationale:
      'A1 and B1 meet MWF 09:00 and A2 and B2 meet TTh 09:00, so only {A1, B2} and {A2, B1} are conflict-free. {A1, B2} ranks first because its lowest section ID sorts first.',
    citations: ['planning/14 §First vertical slice', 'ADR-0010 §3 and §4'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-005',
    family: FAMILY,
    title: 'Four candidate sets give the top three, distinct, in tie-break order',
    requirementIds: REQUIREMENTS,
    inputs: FOUR_SETS,
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: TOP_THREE,
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(CA2, CB2),
        claim: 'only the best three options are returned',
      },
    ],
    rationale:
      'All four sets pass and meet no preference, so the section-ID tie-break orders them {A1,B1}, {A1,B2}, {A2,B1}, {A2,B2} and the best three are kept. Each differs from the others in a section.',
    citations: ['ADR-0010 §4'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-006',
    family: FAMILY,
    title: 'Listing courses and sections in reverse order doesn’t change the answer',
    requirementIds: [...REQUIREMENTS, 'NFR-01'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id, math101.id],
      sections: [CB2, CB1, CA2, CA1],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: TOP_THREE,
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(CA2, CB2),
        claim: 'input order never changes which options are returned',
      },
    ],
    rationale:
      'The result depends on the sections and constraints, never on the order they are listed in.',
    citations: ['ADR-0010 §4 (shuffle determinism)', 'NFR-01'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-007',
    family: FAMILY,
    title: 'Two single-section courses at the same time have no plan, with the conflict shown',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [SAME_A, SAME_B],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(SAME_A, SAME_B),
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a plan with a meeting conflict is never offered',
      },
    ],
    rationale:
      'Both sections meet MWF 09:00–09:50 and each course has one section, so the finished search proves no plan. The conflict set is not claimed minimal.',
    citations: ['ADR-0010 §3 and §5'],
  }),
  scheduleCase({
    id: 'GC-SOLVE-010',
    family: FAMILY,
    title: 'An undefined travel time ranks an option after a passing one',
    requirementIds: [...REQUIREMENTS, 'AC08'],
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [NORTH_A, NORTH_B, SOUTH_B],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        { sectionIds: sectionIdsOf(NORTH_A, NORTH_B), scheduleFeasibility: SCHEDULE_PASS },
        {
          sectionIds: sectionIdsOf(NORTH_A, SOUTH_B),
          scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
            {
              reasonCode: ReasonCode.TransitionTimeUndefined,
              sectionIds: sectionIdsOf(NORTH_A, SOUTH_B),
            },
          ]),
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(NORTH_A, SOUTH_B),
        claim: 'a campus pair with no configured time is never PASS',
      },
    ],
    rationale:
      'The empty table gives no travel time from north to south, so that pair is UNKNOWN. An UNKNOWN option never ranks above a PASS one.',
    citations: ['ADR-0010 §4 and §8'],
  }),
];
