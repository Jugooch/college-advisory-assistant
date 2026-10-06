/**
 * @file Golden cases: meetings in half-terms and other partial date ranges (#218, AC07). GC-HALF-001–004.
 * @module @caa/test-kit/golden/cases/term-date-overlap
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, Weekday } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { mustNot } from '../golden-expectations';
import {
  MEETING_PASS,
  meetingCheck,
  meetingConflictCase,
  meetingInputs,
} from '../golden-meeting-conflict-factories';
import { GoldenScheduleFamily } from '../golden-rule-family';
import { scheduleSection, sectionIdsOf } from '../golden-schedule-factories';

const { math102, phys201 } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.TermDateOverlap;
const REQUIREMENTS = ['FR-07', 'AC07', 'T05'];
const MODEL = 'planning/08 §Schedule model (both calendar intervals and meeting instances)';
const NO_CONFLICT = mustNot(CheckState.Fail, 'must not report a conflict on disjoint dates');
const CONFLICTS = mustNot(CheckState.Pass, 'must not pass meetings that share a date and time');

/** DEMO-MATH 102, MWF 09:00–09:50 in the first half (2027-01-11 to 2027-03-05). */
const FIRST_HALF = scheduleSection(math102.id, 2101, {
  section: { startsOn: '2027-01-11', endsOn: '2027-03-05' },
});
/** DEMO-PHYS 201, MWF 09:00–09:50 in the second half (2027-03-08 to 2027-05-07). */
const SECOND_HALF = scheduleSection(phys201.id, 2102, {
  section: { startsOn: '2027-03-08', endsOn: '2027-05-07' },
});
/** DEMO-PHYS 201, MWF 09:00–09:50 from Friday 2027-03-05, the first half's last day. */
const FROM_MARCH_5 = scheduleSection(phys201.id, 2103, { section: { startsOn: '2027-03-05' } });
/** DEMO-PHYS 201, MWF 09:00–09:50 all term. */
const WHOLE_TERM = scheduleSection(phys201.id, 2104);
/** DEMO-PHYS 201, TTh 09:00–09:50 from 2027-03-05. */
const TTH_FROM_MARCH_5 = scheduleSection(phys201.id, 2105, {
  meeting: { weekdays: [Weekday.Tuesday, Weekday.Thursday] },
  section: { startsOn: '2027-03-05' },
});

/**
 * Expects one meeting conflict between the first-half section and another.
 *
 * @param other - The other section.
 * @param dates - The shared dates.
 * @returns The expected check.
 */
function conflictWithFirstHalf(
  other: ReturnType<typeof scheduleSection>,
  dates: { firstDate: string; lastDate: string; weekdays: readonly string[] },
): ReturnType<typeof meetingCheck> {
  return meetingCheck(CheckState.Fail, [
    {
      reasonCode: ReasonCode.MeetingConflict,
      sectionIds: sectionIdsOf(FIRST_HALF, other),
      sharedDates: dates,
    },
  ]);
}

/** Development cases for the TERM_DATE_OVERLAP family. */
export const TERM_DATE_OVERLAP_CASES: readonly GoldenCase[] = [
  meetingConflictCase({
    id: 'GC-HALF-001',
    family: FAMILY,
    title: 'The same weekly time in the two halves of the term fits',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(FIRST_HALF, SECOND_HALF),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale: 'The first half ends 2027-03-05 and the second starts 2027-03-08: no shared date.',
    citations: ['planning/13 AC07', MODEL],
  }),
  meetingConflictCase({
    id: 'GC-HALF-002',
    family: FAMILY,
    title: 'A section starting on the first half’s last day conflicts on that day only',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(FIRST_HALF, FROM_MARCH_5),
    expected: [
      conflictWithFirstHalf(FROM_MARCH_5, {
        firstDate: '2027-03-05',
        lastDate: '2027-03-05',
        weekdays: ['FRIDAY'],
      }),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale: 'Friday 2027-03-05 is in both date ranges and both meet then at 09:00–09:50.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-HALF-003',
    family: FAMILY,
    title: 'A first-half section conflicts with a whole-term one through the first half',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(FIRST_HALF, WHOLE_TERM),
    expected: [
      conflictWithFirstHalf(WHOLE_TERM, {
        firstDate: '2027-01-11',
        lastDate: '2027-03-05',
        weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
      }),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale: 'Both meet MWF 09:00–09:50 on every date of the first half.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-HALF-004',
    family: FAMILY,
    title: 'Overlapping date ranges with no shared meeting day fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(FIRST_HALF, TTH_FROM_MARCH_5),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale:
      'The ranges share Friday 2027-03-05, but the TTh section doesn’t meet that day, so no meeting instance overlaps.',
    citations: [MODEL],
  }),
];
