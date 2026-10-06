/**
 * @file Golden scheduling cases: hard rules at their limits, never relaxed or satisfied by unknown data (#220). GC-HARD-003 and GC-HARD-005 to -007.
 * @module @caa/test-kit/golden/cases/hard-constraint-limits
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckKind,
  CheckState,
  MeetingLocationKind,
  ReasonCode,
  ScheduleOutcome,
  SectionModality,
  Weekday,
} from '@caa/domain';

import {
  buildAllowedCampuses,
  buildAllowedModalities,
  buildCreditRange,
  buildUnavailableTime,
  HARD_STRENGTH,
} from '../../builders/schedule-constraint.builder';
import { SYNTHETIC_CAMPUSES } from '../../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  expectOneOption,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, math102 } = SYNTHETIC_COURSES;
const { north } = SYNTHETIC_CAMPUSES;
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

/** DEMO-MATH 102, TTh 09:00–09:50. */
const MATH_TTH = scheduleSection(math102.id, 3202, { meeting: { weekdays: TTH } });
/** DEMO-MATH 102, MWF 10:00–10:50: meets Fridays, but not before 10:00. */
const MATH_MWF_1000 = scheduleSection(math102.id, 3203, {
  meeting: { startTime: '10:00', endTime: '10:50' },
});
/** DEMO-MATH 101, MWF 11:00–11:50. */
const MATH101_MWF = scheduleSection(math101.id, 3205, {
  meeting: { startTime: '11:00', endTime: '11:50' },
});
/** DEMO-MATH 102 with a meeting whose location is to be announced, TTh 09:00–09:50. */
const MATH_TBA_LOCATION = scheduleSection(math102.id, 3206, {
  meeting: { weekdays: TTH, location: null },
});
/** DEMO-MATH 102, online synchronous, TTh 09:00–09:50. */
const MATH_ONLINE = scheduleSection(math102.id, 3207, {
  meeting: { weekdays: TTH, location: { kind: MeetingLocationKind.Online } },
  section: { campusId: null, modality: SectionModality.OnlineSynchronous },
});

/** Hard and soft constraint cases. */
export const HARD_CONSTRAINT_LIMIT_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-HARD-003',
    family: FAMILY,
    title: 'Two 3.00-credit courses under a hard 3.00-credit maximum have no plan',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [MATH101_MWF, MATH_TTH],
      constraints: [
        buildCreditRange({
          ...HARD_STRENGTH,
          minCreditsHundredths: 100,
          maxCreditsHundredths: 300,
        }),
      ],
    }),
    expected: expectNoPlan([
      {
        check: {
          kind: CheckKind.CreditLoad,
          state: CheckState.Fail,
          reasonCode: ReasonCode.CreditLimitExceeded,
        },
        issues: [],
      },
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a hard credit maximum is never relaxed',
      },
    ],
    rationale:
      'Both courses are required and total 6.00 credits against a hard 3.00 maximum. The sections don’t conflict, so the credit rule alone proves the plan infeasible.',
    citations: [CONSTRAINTS, 'ADR-0010 §3 and §5'],
  }),
  scheduleCase({
    id: 'GC-HARD-005',
    family: FAMILY,
    title: 'A section starting exactly when a hard unavailable block ends is allowed',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_MWF_1000],
      constraints: [
        buildUnavailableTime({
          ...HARD_STRENGTH,
          weekdays: WEEKDAYS,
          startTime: '00:00',
          endTime: '10:00',
        }),
      ],
    }),
    expected: expectOneOption(sectionIdsOf(MATH_MWF_1000)),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a block ending at 10:00 doesn’t touch a meeting starting at 10:00',
      },
    ],
    rationale:
      'Times are half-open, so the block [00:00, 10:00) and the meeting [10:00, 10:50) share no minute.',
    citations: [CONSTRAINTS, 'ADR-0010 §3', 'tech-lead decision on #251 (half-open blocks)'],
  }),
  scheduleCase({
    id: 'GC-HARD-006',
    family: FAMILY,
    title: 'A hard campus rule can’t be met by a location still to be announced',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_TBA_LOCATION],
      constraints: [buildAllowedCampuses({ ...HARD_STRENGTH, campusIds: [north.id] })],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(MATH_TBA_LOCATION),
          scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
            {
              reasonCode: ReasonCode.MeetingLocationUnknown,
              sectionIds: sectionIdsOf(MATH_TBA_LOCATION),
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
        claim: 'an unknown location is never treated as an allowed campus',
      },
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'an unknown location is not a verified violation',
      },
    ],
    rationale:
      'The meeting’s campus is to be announced, so the hard campus rule can’t be checked. The option stays, UNKNOWN and never PASS.',
    citations: [CONSTRAINTS, 'ADR-0010 §3 and Amendment 2'],
  }),
  scheduleCase({
    id: 'GC-HARD-007',
    family: FAMILY,
    title: 'A hard in-person rule leaves no plan when the only section is online',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_ONLINE],
      constraints: [
        buildAllowedModalities({ ...HARD_STRENGTH, modalities: [SectionModality.InPerson] }),
      ],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.ModalityNotAllowed,
          sectionIds: sectionIdsOf(MATH_ONLINE),
          constraintIndex: 0,
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a hard modality rule is never relaxed',
      },
    ],
    rationale: 'The only section is online synchronous, which the hard rule excludes.',
    citations: [CONSTRAINTS, 'ADR-0010 §3 and §5'],
  }),
];
