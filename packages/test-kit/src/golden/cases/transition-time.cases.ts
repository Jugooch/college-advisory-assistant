/**
 * @file Golden cases: travel between campuses against the tenant's transition table (#218,
 *   AC08). GC-TRAVEL-001–006 and -008;
 *   GC-TRAVEL-007, about three sections, is a solver case in `solver-travel-and-tba.cases.ts`.
 * @module @caa/test-kit/golden/cases/transition-time
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, MeetingLocationKind, ReasonCode, SectionModality, Weekday } from '@caa/domain';

import { buildCampusTransition } from '../../builders/campus-transition-policy.builder';
import { SYNTHETIC_CAMPUSES } from '../../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import {
  MEETING_PASS,
  meetingCheck,
  meetingConflictCase,
  meetingInputs,
} from '../golden-meeting-conflict-factories';
import { GoldenScheduleFamily } from '../golden-rule-family';
import { scheduleSection, sectionIdsOf } from '../golden-schedule-factories';

const { math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const FAMILY = GoldenScheduleFamily.TransitionTime;
const REQUIREMENTS = ['FR-07', 'AC08', 'T05'];
const TRAVEL = 'ADR-0010 §8';
const NO_TRIP = mustNot(CheckState.Fail, 'must not require travel where none applies');
const ON_SOUTH = { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null } as const;

/**
 * Builds a DEMO-PHYS 201 section on the south campus with one meeting.
 *
 * @param seed - The section seed.
 * @param meeting - Weekdays and local times.
 * @returns The section.
 */
function southSection(
  seed: number,
  meeting: { weekdays?: readonly Weekday[]; startTime: string; endTime: string },
): ReturnType<typeof scheduleSection> {
  return scheduleSection(phys201.id, seed, {
    meeting: { ...meeting, location: ON_SOUTH },
    section: { campusId: south.id },
  });
}

/** DEMO-MATH 102 on the north campus, MWF 09:00–09:50. */
const NORTH_0900 = scheduleSection(math102.id, 2201);
const SOUTH_1000 = southSection(2202, { startTime: '10:00', endTime: '10:50' });
const SOUTH_1100 = southSection(2203, { startTime: '11:00', endTime: '11:50' });
const SOUTH_0950 = southSection(2204, { startTime: '09:50', endTime: '10:40' });
const NORTH_0950 = scheduleSection(phys201.id, 2205, {
  meeting: { startTime: '09:50', endTime: '10:40' },
});
const ONLINE_0900 = scheduleSection(math102.id, 2206, {
  meeting: { location: { kind: MeetingLocationKind.Online } },
  section: { campusId: null, modality: SectionModality.OnlineSynchronous },
});
const SOUTH_TTH_0950 = southSection(2207, {
  weekdays: [Weekday.Tuesday, Weekday.Thursday],
  startTime: '09:50',
  endTime: '10:40',
});

/**
 * Expects one transition issue from north to south.
 *
 * @param later - The later, south-campus section.
 * @param minutes - The required minutes (`null` when unconfigured) and the available gap.
 * @param minutes.required - Minutes the table requires.
 * @param minutes.available - Minutes between the meetings.
 * @returns The expected check.
 */
function northToSouth(
  later: ReturnType<typeof scheduleSection>,
  minutes: { required: number | null; available: number },
): ReturnType<typeof meetingCheck> {
  const isConfigured = minutes.required !== null;
  return meetingCheck(isConfigured ? CheckState.Fail : CheckState.Unknown, [
    {
      reasonCode: isConfigured
        ? ReasonCode.TransitionTimeInsufficient
        : ReasonCode.TransitionTimeUndefined,
      sectionIds: sectionIdsOf(NORTH_0900, later),
      fromCampusId: north.id,
      toCampusId: south.id,
      requiredMinutes: minutes.required,
      availableMinutes: minutes.available,
    },
  ]);
}

/** Development cases for the TRANSITION_TIME family. */
export const TRANSITION_TIME_CASES: readonly GoldenCase[] = [
  meetingConflictCase({
    id: 'GC-TRAVEL-001',
    family: FAMILY,
    title: 'Ten minutes from north to south where fifteen are required is a FAIL',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, SOUTH_1000, [buildCampusTransition(north.id, south.id, 15)]),
    expected: [northToSouth(SOUTH_1000, { required: 15, available: 10 })],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass a trip shorter than required')],
    rationale: '09:50 to 10:00 gives 10 minutes; the table requires 15 from north to south.',
    citations: ['planning/13 AC08', TRAVEL],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-002',
    family: FAMILY,
    title: 'A gap equal to the required time passes',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, SOUTH_1000, [buildCampusTransition(north.id, south.id, 10)]),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_TRIP],
    rationale: 'A gap is insufficient only below the required time; 10 of 10 is enough.',
    citations: [TRAVEL],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-003',
    family: FAMILY,
    title: 'An empty table leaves a 70-minute trip UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, SOUTH_1100),
    expected: [northToSouth(SOUTH_1100, { required: null, available: 70 })],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN],
    rationale: 'No entry for north→south means UNKNOWN whatever the gap, never an assumed zero.',
    citations: [TRAVEL, 'planning/08 §Authority and result semantics'],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-004',
    family: FAMILY,
    title: 'Only the reverse pair configured leaves a back-to-back trip UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, SOUTH_0950, [buildCampusTransition(south.id, north.id, 10)]),
    expected: [northToSouth(SOUTH_0950, { required: null, available: 0 })],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN],
    rationale: 'Pairs are ordered from the earlier meeting’s campus; north→south has no entry.',
    citations: [TRAVEL],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-005',
    family: FAMILY,
    title: 'Back-to-back on one campus needs no transition',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, NORTH_0950),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_TRIP, mustNot(CheckState.Unknown, 'one campus needs no table entry')],
    rationale: 'The same campus needs no transition, so an empty table doesn’t matter.',
    citations: [TRAVEL],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-006',
    family: FAMILY,
    title: 'An online meeting before a south meeting needs no trip',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(ONLINE_0900, SOUTH_0950),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_TRIP, mustNot(CheckState.Unknown, 'an online meeting has no campus')],
    rationale: 'A meeting with no campus isn’t subject to a transition.',
    citations: [TRAVEL, 'ADR-0010 Amendment 2'],
  }),
  meetingConflictCase({
    id: 'GC-TRAVEL-008',
    family: FAMILY,
    title: 'Campuses on different weekdays need no trip',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(NORTH_0900, SOUTH_TTH_0950),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_TRIP, mustNot(CheckState.Unknown, 'no shared date, no transition')],
    rationale: 'MWF and TTh share no active date, so no transition applies.',
    citations: [TRAVEL],
  }),
];
