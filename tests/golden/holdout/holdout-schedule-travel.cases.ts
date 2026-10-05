/**
 * @file Frozen holdout scheduling cases for campus travel time and TBA meeting times. Kept out of
 *   engine development; see README.md in this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-schedule-travel
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, MeetingLocationKind, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';
import {
  buildCampusTransition,
  expectNoPlan,
  expectOneOption,
  type GoldenScheduleCase,
  GoldenScheduleFamily,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const BOTH = [math102.id, phys201.id];
const TTH = [Weekday.Tuesday, Weekday.Thursday];

/** DEMO-MATH 102 on the south campus, TTh 08:00–09:15. */
const MATH_SOUTH_0800 = scheduleSection(math102.id, 1008, {
  meeting: {
    weekdays: TTH,
    startTime: '08:00',
    endTime: '09:15',
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { campusId: south.id },
});
/** DEMO-PHYS 201 on the north campus, TTh 09:30–10:45: 15 minutes after {@link MATH_SOUTH_0800}. */
const PHYS_NORTH_0930 = scheduleSection(phys201.id, 1009, {
  meeting: { weekdays: TTH, startTime: '09:30', endTime: '10:45' },
});
/** DEMO-MATH 102 on Tuesdays, times to be announced, on the north campus. */
const MATH_TBA_TUESDAY = scheduleSection(math102.id, 1010, {
  meeting: { weekdays: [Weekday.Tuesday], startTime: null, endTime: null },
});
/** DEMO-PHYS 201, TTh 09:00–09:50 on the north campus. */
const PHYS_TTH_0900 = scheduleSection(phys201.id, 1011, { meeting: { weekdays: TTH } });
const SOUTH_THEN_NORTH = sectionIdsOf(MATH_SOUTH_0800, PHYS_NORTH_0930);

/** Holdout scheduling cases about travel time and TBA times. */
export const HOLDOUT_SCHEDULE_TRAVEL_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GH-TRAVEL-001',
    family: GoldenScheduleFamily.TransitionTime,
    title: 'Fifteen minutes from south to north where twenty are required is rejected',
    requirementIds: ['FR-07', 'FR-18', 'AC08', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_SOUTH_0800, PHYS_NORTH_0930],
      transitions: [
        buildCampusTransition(south.id, north.id, 20),
        buildCampusTransition(north.id, south.id, 5),
      ],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.TransitionTimeInsufficient,
          sectionIds: SOUTH_THEN_NORTH,
          fromCampusId: south.id,
          toCampusId: north.id,
          requiredMinutes: 20,
          availableMinutes: 15,
        },
      ]),
    ]),
    prohibitedClaims: [
      { outcome: ScheduleOutcome.OptionsFound, claim: 'must not use the reverse pair’s 5 minutes' },
    ],
    rationale:
      'The earlier meeting is on the south campus, so the south→north entry (20) applies; 09:15 to 09:30 gives 15.',
    citations: ['planning/13 AC08', 'ADR-0010 §8'],
  }),
  scheduleCase({
    id: 'GH-TRAVEL-002',
    family: GoldenScheduleFamily.TransitionTime,
    title: 'Only the reverse pair configured leaves the trip UNKNOWN',
    requirementIds: ['FR-07', 'FR-18', 'AC08', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_SOUTH_0800, PHYS_NORTH_0930],
      transitions: [buildCampusTransition(north.id, south.id, 5)],
    }),
    expected: expectOneOption(
      SOUTH_THEN_NORTH,
      scheduleCheck(CheckState.Unknown, [
        {
          reasonCode: ReasonCode.TransitionTimeUndefined,
          sectionIds: SOUTH_THEN_NORTH,
          fromCampusId: south.id,
          toCampusId: north.id,
          requiredMinutes: null,
          availableMinutes: 15,
        },
      ]),
    ),
    prohibitedClaims: [
      { state: CheckState.Pass, claim: 'an unconfigured pair is never assumed to need no time' },
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'unknown data never proves infeasibility' },
    ],
    rationale:
      'The table has no south→north entry, so the trip is UNKNOWN whatever the gap, and the candidate is kept as an UNKNOWN option.',
    citations: ['ADR-0010 §3 and §8', 'planning/08 §Authority and result semantics'],
  }),
  scheduleCase({
    id: 'GH-TBA-001',
    family: GoldenScheduleFamily.MeetingTimeUnknown,
    title: 'A Tuesday meeting with TBA times against a timed TTh meeting is UNKNOWN',
    requirementIds: ['FR-07', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: BOTH,
      sections: [MATH_TBA_TUESDAY, PHYS_TTH_0900],
    }),
    expected: expectOneOption(
      sectionIdsOf(MATH_TBA_TUESDAY, PHYS_TTH_0900),
      scheduleCheck(CheckState.Unknown, [
        {
          reasonCode: ReasonCode.MeetingTimeUnknown,
          sectionIds: sectionIdsOf(MATH_TBA_TUESDAY, PHYS_TTH_0900),
        },
      ]),
    ),
    prohibitedClaims: [
      { state: CheckState.Pass, claim: 'a TBA time sharing Tuesdays is never assumed clear' },
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'a TBA time can’t prove a conflict' },
    ],
    rationale:
      'Both meet on every Tuesday of the term and one time is to be announced, so the pair is UNKNOWN, never PASS or FAIL.',
    citations: ['ADR-0010 Amendment 1 (GR-02)', 'planning/08 §Schedule model'],
  }),
];
