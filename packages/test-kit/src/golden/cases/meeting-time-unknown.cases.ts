/**
 * @file Golden cases: meetings whose times or days are to be announced, which are never PASS
 *   where they could meet (#218, ruling GR-02). GC-TBA-001–003, -005 and -006;
 *   GC-TBA-004, about a hard constraint, is a solver case in `solver-travel-and-tba.cases.ts`.
 * @module @caa/test-kit/golden/cases/meeting-time-unknown
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, ReasonCode, Weekday } from '@caa/domain';

import { buildOnlineAsynchronousSection } from '../../builders/section.builder';
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
const FAMILY = GoldenScheduleFamily.MeetingTimeUnknown;
const REQUIREMENTS = ['FR-07', 'T05'];
const GR_02 = 'ADR-0010 Amendment 1 (ruling GR-02)';
const NEVER_FAIL = mustNot(CheckState.Fail, 'a time to be announced can’t prove a conflict');
const NO_SHARED_DATE = mustNot(CheckState.Unknown, 'no shared possible date, nothing to verify');
const TBA_TIMES = { startTime: null, endTime: null };
const MW = [Weekday.Monday, Weekday.Wednesday];

/** DEMO-MATH 102: days and times to be announced, all term. */
const TBA_ALL_TERM = scheduleSection(math102.id, 2301, {
  meeting: { ...TBA_TIMES, weekdays: null },
});
/** DEMO-MATH 102: days and times to be announced, first half. */
const TBA_FIRST_HALF = scheduleSection(math102.id, 2302, {
  meeting: { ...TBA_TIMES, weekdays: null },
  section: { startsOn: '2027-01-11', endsOn: '2027-03-05' },
});
/** DEMO-MATH 102: Mondays and Wednesdays, times to be announced, all term. */
const TBA_MW = scheduleSection(math102.id, 2303, { meeting: { ...TBA_TIMES, weekdays: MW } });
/** DEMO-MATH 102: online asynchronous, no meetings. */
const ASYNC = buildOnlineAsynchronousSection({ courseId: math102.id }, 2304);
/** DEMO-PHYS 201, MWF 09:00–09:50 all term. */
const PHYS_MWF = scheduleSection(phys201.id, 2311);
/** DEMO-PHYS 201, MWF 09:00–09:50 in the second half. */
const PHYS_SECOND_HALF = scheduleSection(phys201.id, 2312, {
  section: { startsOn: '2027-03-08', endsOn: '2027-05-07' },
});
/** DEMO-PHYS 201, TTh 09:00–09:50 all term. */
const PHYS_TTH = scheduleSection(phys201.id, 2313, {
  meeting: { weekdays: [Weekday.Tuesday, Weekday.Thursday] },
});
/** DEMO-PHYS 201, WF 09:00–09:50 all term. */
const PHYS_WF = scheduleSection(phys201.id, 2314, {
  meeting: { weekdays: [Weekday.Wednesday, Weekday.Friday] },
});

/** Development cases for the MEETING_TIME_UNKNOWN family. */
export const MEETING_TIME_UNKNOWN_CASES: readonly GoldenCase[] = [
  meetingConflictCase({
    id: 'GC-TBA-001',
    family: FAMILY,
    title: 'A whole-term TBA meeting against a timed MWF meeting is UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(TBA_ALL_TERM, PHYS_MWF),
    expected: [
      meetingCheck(CheckState.Unknown, [
        {
          reasonCode: ReasonCode.MeetingTimeUnknown,
          sectionIds: sectionIdsOf(TBA_ALL_TERM, PHYS_MWF),
        },
      ]),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NEVER_FAIL],
    rationale: 'A meeting with unknown days and times could fall on any MWF 09:00 of the term.',
    citations: [GR_02, 'planning/08 §Schedule model (unknown times cannot be PASS)'],
  }),
  meetingConflictCase({
    id: 'GC-TBA-002',
    family: FAMILY,
    title: 'A first-half TBA meeting against a second-half meeting fits',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(TBA_FIRST_HALF, PHYS_SECOND_HALF),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_SHARED_DATE, NEVER_FAIL],
    rationale:
      'Even with every weekday possible, the halves share no date, so the unknown time can’t conflict.',
    citations: [GR_02],
  }),
  meetingConflictCase({
    id: 'GC-TBA-003',
    family: FAMILY,
    title: 'An online asynchronous section has nothing to conflict on time',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(ASYNC, PHYS_MWF),
    expected: [MEETING_PASS],
    prohibitedClaims: [mustNot(CheckState.Unknown, 'no meeting means no unknown time'), NEVER_FAIL],
    rationale: 'An asynchronous section has no meetings at all, which is known data, not a TBA.',
    citations: ['planning/08 §Schedule model', 'ADR-0010 §8'],
  }),
  meetingConflictCase({
    id: 'GC-TBA-005',
    family: FAMILY,
    title: 'Known MW days with TBA times against a TTh meeting fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(TBA_MW, PHYS_TTH),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_SHARED_DATE, NEVER_FAIL],
    rationale: 'Mondays and Wednesdays never fall on a Tuesday or Thursday, whatever the times.',
    citations: [GR_02],
  }),
  meetingConflictCase({
    id: 'GC-TBA-006',
    family: FAMILY,
    title: 'Known MW days with TBA times against a WF meeting are UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(TBA_MW, PHYS_WF),
    expected: [
      meetingCheck(CheckState.Unknown, [
        { reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: sectionIdsOf(TBA_MW, PHYS_WF) },
      ]),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NEVER_FAIL],
    rationale:
      'Both meet every Wednesday, and one time is to be announced: UNKNOWN, never PASS or FAIL.',
    citations: [GR_02],
  }),
];
