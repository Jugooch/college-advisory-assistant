/**
 * @file Golden scheduling cases that need the solver beyond a section pair: travel between three
 *   sections (GC-TRAVEL-007, AC08) and a time to be announced under a hard availability rule
 *   (GC-TBA-004).
 * @module @caa/test-kit/golden/cases/solver-travel-and-tba
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, MeetingLocationKind, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildCampus } from '../../builders/campus.builder';
import { buildCampusTransition } from '../../builders/campus-transition-policy.builder';
import { buildUnavailableTime, HARD_STRENGTH } from '../../builders/schedule-constraint.builder';
import { SYNTHETIC_CAMPUSES } from '../../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const middle = buildCampus({}, 3);

/** DEMO-MATH 102, north, MWF 09:00–09:50. */
const FIRST = scheduleSection(math102.id, 3501);
/** DEMO-MATH 101 on the middle campus, MWF 10:00–10:50. */
const SECOND = scheduleSection(math101.id, 3502, {
  meeting: {
    startTime: '10:00',
    endTime: '10:50',
    location: { kind: MeetingLocationKind.OnCampus, campusId: middle.id, room: null },
  },
  section: { campusId: middle.id },
});
/** DEMO-PHYS 201, south, MWF 12:00–12:50. */
const THIRD = scheduleSection(phys201.id, 3503, {
  meeting: {
    startTime: '12:00',
    endTime: '12:50',
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { campusId: south.id },
});
/** DEMO-MATH 102 with its days and times to be announced. */
const TBA_SECTION = scheduleSection(math102.id, 3511, {
  meeting: { weekdays: null, startTime: null, endTime: null },
});

/** Travel across three sections, and a TBA time under a hard availability rule. */
export const SOLVER_TRAVEL_AND_TBA_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-TRAVEL-007',
    family: GoldenScheduleFamily.TransitionTime,
    title: 'Travel is checked for every pair of sections, not only consecutive ones',
    requirementIds: ['FR-07', 'FR-18', 'AC08', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id, math101.id, phys201.id],
      sections: [FIRST, SECOND, THIRD],
      transitions: [
        buildCampusTransition(north.id, middle.id, 10),
        buildCampusTransition(middle.id, south.id, 60),
        buildCampusTransition(north.id, south.id, 180),
      ],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.TransitionTimeInsufficient,
          sectionIds: sectionIdsOf(FIRST, THIRD),
          fromCampusId: north.id,
          toCampusId: south.id,
          requiredMinutes: 180,
          availableMinutes: 130,
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim:
          'every pair on a shared date counts, so the north-to-south shortfall blocks the plan',
      },
    ],
    rationale:
      'North to middle needs 10 and has 10, and middle to south needs 60 and has 70, so each consecutive pair passes. North to south needs 180 and has 130 (12:00 minus 09:50), and ADR-0010 §8 applies the rule to every pair.',
    citations: ['ADR-0010 §8', 'planning/13 AC08'],
  }),
  scheduleCase({
    id: 'GC-TBA-004',
    family: GoldenScheduleFamily.MeetingTimeUnknown,
    title: 'A time to be announced never satisfies a hard no-Fridays rule',
    requirementIds: ['FR-07', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [TBA_SECTION],
      constraints: [
        buildUnavailableTime({
          ...HARD_STRENGTH,
          weekdays: [Weekday.Friday],
          startTime: '00:00',
          endTime: '24:00',
        }),
      ],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(TBA_SECTION),
          scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
            {
              reasonCode: ReasonCode.MeetingTimeUnknown,
              sectionIds: sectionIdsOf(TBA_SECTION),
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
        claim: 'a TBA meeting can’t satisfy hard availability, so the option is never PASS',
      },
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a time to be announced can’t prove a violation',
      },
    ],
    rationale:
      'The section’s days and times are to be announced, so whether it meets on a Friday is unknown. The option is kept as UNKNOWN MEETING_TIME_UNKNOWN, never PASS.',
    citations: ['ADR-0010 §3 and Amendment 1', 'planning/08 §Schedule model'],
  }),
];
