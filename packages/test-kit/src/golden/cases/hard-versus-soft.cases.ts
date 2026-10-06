/**
 * @file Golden scheduling cases: a hard rule removes options and a preference only ranks them (#220). GC-HARD-001, -002 and -004.
 * @module @caa/test-kit/golden/cases/hard-versus-soft
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildUnavailableTime, HARD_STRENGTH } from '../../builders/schedule-constraint.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectOneOption,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math102 } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.HardVersusSoft;
const REQUIREMENTS = ['FR-07', 'FR-08', 'FR-18', 'T05'];
const CONSTRAINTS = 'planning/08 §Constraint formulation';
const TTH = [Weekday.Tuesday, Weekday.Thursday];
const WEEKDAYS = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
];
const NO_FRIDAYS = { weekdays: [Weekday.Friday], startTime: '00:00', endTime: '24:00' };

/** DEMO-MATH 102, MWF 09:00–09:50. */
const MATH_MWF = scheduleSection(math102.id, 3201);
/** DEMO-MATH 102, TTh 09:00–09:50. */
const MATH_TTH = scheduleSection(math102.id, 3202, { meeting: { weekdays: TTH } });
/** DEMO-MATH 102, MWF 10:00–10:50: meets Fridays, but not before 10:00. */
const MATH_MWF_1000 = scheduleSection(math102.id, 3203, {
  meeting: { startTime: '10:00', endTime: '10:50' },
});
/** DEMO-MATH 102, TTh 08:00–08:50: never on Friday, but before 10:00. Its ID sorts last. */
const MATH_TTH_0800 = scheduleSection(math102.id, 3204, {
  meeting: { weekdays: TTH, startTime: '08:00', endTime: '08:50' },
});

/** Hard and soft constraint cases. */
export const HARD_VERSUS_SOFT_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-HARD-001',
    family: FAMILY,
    title: 'A hard no-Fridays rule removes the section that meets on Friday',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_MWF, MATH_TTH],
      constraints: [buildUnavailableTime({ ...HARD_STRENGTH, ...NO_FRIDAYS })],
    }),
    expected: expectOneOption(sectionIdsOf(MATH_TTH)),
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(MATH_MWF),
        claim: 'a section that breaks a hard rule is never offered',
      },
    ],
    rationale:
      'The MWF section meets on Friday, which the hard rule forbids, so only the TTh section is an option.',
    citations: [CONSTRAINTS, 'ADR-0010 §3'],
  }),
  scheduleCase({
    id: 'GC-HARD-002',
    family: FAMILY,
    title: 'A preferred no-Fridays rule still offers the Friday section, with the miss listed',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_MWF],
      constraints: [buildUnavailableTime(NO_FRIDAYS)],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(MATH_MWF),
          scheduleFeasibility: SCHEDULE_PASS,
          unmetPreferenceIndexes: [0],
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a preference is never treated as a hard rule',
      },
    ],
    rationale:
      'A preference only ranks options. The only section is offered and the unmet preference is listed.',
    citations: [CONSTRAINTS, 'ADR-0010 §4'],
  }),
  scheduleCase({
    id: 'GC-HARD-004',
    family: FAMILY,
    title: 'Preferences rank in the student’s priority order, with no weighted sum',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_MWF_1000, MATH_TTH_0800],
      constraints: [
        buildUnavailableTime({ ...NO_FRIDAYS, priorityRank: 1 }),
        buildUnavailableTime({
          priorityRank: 2,
          weekdays: WEEKDAYS,
          startTime: '00:00',
          endTime: '10:00',
        }),
      ],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(MATH_TTH_0800),
          scheduleFeasibility: SCHEDULE_PASS,
          unmetPreferenceIndexes: [1],
        },
        {
          sectionIds: sectionIdsOf(MATH_MWF_1000),
          scheduleFeasibility: SCHEDULE_PASS,
          unmetPreferenceIndexes: [0],
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'preferences never remove an option',
      },
    ],
    rationale:
      'The TTh 08:00 section meets rank 1 (no Fridays) and misses rank 2. The MWF 10:00 section does the opposite. Rank 1 decides, so TTh ranks first, although its section ID sorts after the other’s.',
    citations: [CONSTRAINTS, 'ADR-0010 §4'],
  }),
];
