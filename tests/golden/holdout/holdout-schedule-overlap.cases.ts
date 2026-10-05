/**
 * @file Frozen holdout scheduling cases for meeting overlap and half-terms. Kept out of engine
 *   development; see README.md in this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-schedule-overlap
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';
import {
  expectNoPlan,
  expectOneOption,
  type GoldenScheduleCase,
  GoldenScheduleFamily,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math102, phys201 } = SYNTHETIC_COURSES;
const BOTH = [math102.id, phys201.id];
const TTH = [Weekday.Tuesday, Weekday.Thursday];
const FIRST_HALF = { startsOn: '2027-01-11', endsOn: '2027-03-05' };
const SECOND_HALF = { startsOn: '2027-03-08', endsOn: '2027-05-07' };

/** DEMO-MATH 102, TTh 13:00–14:15. */
const MATH_TTH_1300 = scheduleSection(math102.id, 1001, {
  meeting: { weekdays: TTH, startTime: '13:00', endTime: '14:15' },
});
/** DEMO-PHYS 201, Th 14:00–15:50: 15 minutes inside {@link MATH_TTH_1300} on Thursdays. */
const PHYS_TH_1400 = scheduleSection(phys201.id, 1002, {
  meeting: { weekdays: [Weekday.Thursday], startTime: '14:00', endTime: '15:50' },
});
/** DEMO-PHYS 201, TTh 14:15–15:30: starts the minute {@link MATH_TTH_1300} ends. */
const PHYS_TTH_1415 = scheduleSection(phys201.id, 1003, {
  meeting: { weekdays: TTH, startTime: '14:15', endTime: '15:30' },
});
/** DEMO-MATH 102, TTh 10:00–11:15 in the first half. */
const MATH_FIRST_HALF_TTH = scheduleSection(math102.id, 1004, {
  meeting: { weekdays: TTH, startTime: '10:00', endTime: '11:15' },
  section: FIRST_HALF,
});
/** DEMO-PHYS 201, TTh 10:00–11:15 in the second half. */
const PHYS_SECOND_HALF_TTH = scheduleSection(phys201.id, 1005, {
  meeting: { weekdays: TTH, startTime: '10:00', endTime: '11:15' },
  section: SECOND_HALF,
});
/** DEMO-MATH 102, MWF 13:00–13:50 in the first half. */
const MATH_FIRST_HALF_MWF = scheduleSection(math102.id, 1006, {
  meeting: { startTime: '13:00', endTime: '13:50' },
  section: FIRST_HALF,
});
/** DEMO-PHYS 201, MWF 13:00–13:50 from Monday 2027-03-01 to the end of the term. */
const PHYS_FROM_MARCH_1 = scheduleSection(phys201.id, 1007, {
  meeting: { startTime: '13:00', endTime: '13:50' },
  section: { startsOn: '2027-03-01' },
});

/** Holdout scheduling cases about meeting overlap and half-terms. */
export const HOLDOUT_SCHEDULE_OVERLAP_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GH-MEET-001',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'A Thursday-only meeting overlapping a TTh meeting conflicts on Thursdays only',
    requirementIds: ['FR-07', 'FR-18', 'T05'],
    inputs: scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_TTH_1300, PHYS_TH_1400] }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(MATH_TTH_1300, PHYS_TH_1400),
          sharedDates: { firstDate: '2027-01-14', lastDate: '2027-05-06', weekdays: ['THURSDAY'] },
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'must not offer overlapping Thursday meetings',
      },
    ],
    rationale:
      '14:00–14:15 lies inside both meetings on every Thursday of the term; Tuesdays share no time. The only candidate breaks a hard rule, so the complete search proves no plan.',
    citations: ['planning/08 §Schedule model', 'ADR-0010 §3 and §5'],
  }),
  scheduleCase({
    id: 'GH-MEET-002',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'A meeting starting the minute another ends on the same campus fits',
    requirementIds: ['FR-07', 'FR-18', 'T05'],
    inputs: scheduleInputs({ requestedCourseIds: BOTH, sections: [MATH_TTH_1300, PHYS_TTH_1415] }),
    expected: expectOneOption(sectionIdsOf(MATH_TTH_1300, PHYS_TTH_1415)),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a 14:15 end and a 14:15 start never overlap',
      },
      { state: CheckState.Unknown, claim: 'the same campus needs no transition time' },
    ],
    rationale:
      'Meeting times are half-open, so 13:00–14:15 and 14:15–15:30 share no minute, and both meet on the north campus.',
    citations: ['planning/08 §Schedule model', 'ADR-0010 §8'],
  }),
  scheduleCase({
    id: 'GH-HALF-001',
    family: GoldenScheduleFamily.TermDateOverlap,
    title: 'TTh at the same time in the first and second halves fits',
    requirementIds: ['FR-07', 'FR-18', 'AC07', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_FIRST_HALF_TTH, PHYS_SECOND_HALF_TTH],
    }),
    expected: expectOneOption(sectionIdsOf(MATH_FIRST_HALF_TTH, PHYS_SECOND_HALF_TTH)),
    prohibitedClaims: [
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'disjoint half-terms never conflict' },
    ],
    rationale:
      'The first half ends 2027-03-05 and the second starts 2027-03-08, so no date is shared and no meeting instance overlaps.',
    citations: ['planning/13 AC07', 'planning/08 §Schedule model'],
  }),
  scheduleCase({
    id: 'GH-HALF-002',
    family: GoldenScheduleFamily.TermDateOverlap,
    title: 'A late-starting section shares the last week of the first half',
    requirementIds: ['FR-07', 'FR-18', 'AC07', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_FIRST_HALF_MWF, PHYS_FROM_MARCH_1],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(MATH_FIRST_HALF_MWF, PHYS_FROM_MARCH_1),
          sharedDates: {
            firstDate: '2027-03-01',
            lastDate: '2027-03-05',
            weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
          },
        },
      ]),
    ]),
    prohibitedClaims: [
      { outcome: ScheduleOutcome.OptionsFound, claim: 'one shared week is enough to conflict' },
    ],
    rationale:
      'Both meet MWF 13:00–13:50 on 2027-03-01, 03-03 and 03-05, the last week of the first half.',
    citations: ['planning/08 §Schedule model', 'ADR-0010 §5'],
  }),
];
