/**
 * @file Golden cases: a section with more than one meeting, a weekly lecture and a one-day Friday
 *   exam slot, against another section (#226). GC-MEET-009–014 and GC-TBA-007.
 * @module @caa/test-kit/golden/cases/multi-meeting
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { CheckState, ReasonCode, Weekday } from '@caa/domain';

import { buildMeetingPattern, buildTbaMeeting } from '../../builders/meeting-pattern.builder';
import { buildSection } from '../../builders/section.builder';
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
import { sectionIdsOf } from '../golden-schedule-factories';

const { math102, phys201 } = SYNTHETIC_COURSES;
const REQUIREMENTS = ['FR-07', 'T05'];
const MODEL = 'planning/08 §Schedule model';
const NO_CONFLICT = mustNot(CheckState.Fail, 'must not report a conflict no meeting instance has');
const CONFLICTS = mustNot(CheckState.Pass, 'must not pass meetings that overlap on a shared date');
const TTH = [Weekday.Tuesday, Weekday.Thursday];
const FRIDAY = [Weekday.Friday];
/** The Friday of the exam slot, in the week before the last day of the term. */
const EXAM_DAY = { startsOn: '2027-04-30', endsOn: '2027-04-30' };
const EXAM_SHARED = { firstDate: '2027-04-30', lastDate: '2027-04-30', weekdays: ['FRIDAY'] };

/**
 * Builds a one-day Friday meeting on 2027-04-30.
 *
 * @param startTime - Local start time.
 * @param endTime - Local end time.
 * @returns The meeting.
 */
function examSlot(startTime: string, endTime: string): ReturnType<typeof buildMeetingPattern> {
  return buildMeetingPattern({ ...EXAM_DAY, weekdays: FRIDAY, startTime, endTime });
}

/** DEMO-MATH 102: MWF 09:00–09:50 all term, and an exam slot Friday 2027-04-30 18:00–20:00. */
const LECTURE = buildSection(
  { courseId: math102.id, meetings: [buildMeetingPattern(), examSlot('18:00', '20:00')] },
  2401,
);

/**
 * Builds a DEMO-PHYS 201 section with a TTh 09:00–09:50 meeting and a second meeting.
 *
 * @param seed - The section seed.
 * @param second - The second meeting.
 * @returns The section.
 */
function withSecond(
  seed: number,
  second: ReturnType<typeof buildMeetingPattern>,
): ReturnType<typeof buildSection> {
  return buildSection(
    {
      courseId: phys201.id,
      meetings: [buildMeetingPattern({ weekdays: TTH }), second],
    },
    seed,
  );
}

/** Exam slot at 14:00–15:00: apart from every LECTURE meeting. */
const APART = withSecond(2402, examSlot('14:00', '15:00'));
/** Exam slot at 19:00–20:30: inside the LECTURE exam slot. */
const EXAM_OVERLAP = withSecond(2403, examSlot('19:00', '20:30'));
/** MWF 09:30–10:20 all term, and an exam slot at 14:00: only the weekly meetings overlap. */
const WEEKLY_OVERLAP = buildSection(
  {
    courseId: phys201.id,
    meetings: [
      buildMeetingPattern({ startTime: '09:30', endTime: '10:20' }),
      examSlot('14:00', '15:00'),
    ],
  },
  2404,
);
/** Exam slot 20:00–21:00: starts when the LECTURE exam slot ends. */
const EXAM_ABUTS = withSecond(2405, examSlot('20:00', '21:00'));
/** Exam slot 19:59–21:00: one minute inside the LECTURE exam slot. */
const EXAM_ONE_MINUTE = withSecond(2406, examSlot('19:59', '21:00'));
/** A Friday 2027-02-05 meeting with its time to be announced, and TTh 09:00. */
const TBA_FRIDAY = withSecond(
  2407,
  buildTbaMeeting({ weekdays: FRIDAY, startsOn: '2027-02-05', endsOn: '2027-02-05' }),
);
/** TBA Friday 2027-02-05, and an exam slot overlapping the LECTURE exam slot. */
const TBA_AND_OVERLAP = buildSection(
  {
    courseId: phys201.id,
    meetings: [
      buildMeetingPattern({ weekdays: TTH }),
      buildTbaMeeting({ weekdays: FRIDAY, startsOn: '2027-02-05', endsOn: '2027-02-05' }),
      examSlot('19:00', '20:30'),
    ],
  },
  2408,
);

/** Development cases for sections with several meetings. */
export const MULTI_MEETING_CASES: readonly GoldenCase[] = [
  meetingConflictCase({
    id: 'GC-MEET-009',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'Two sections of two meetings each, apart in every pairing, fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, APART),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale:
      'Of the four meeting pairs, the MWF lecture and the TTh meeting share no weekday; the Friday 2027-04-30 slots 18:00–20:00 and 14:00–15:00 share a date but not a minute; and each weekly meeting is apart from the other section’s exam slot (09:00–09:50 against 14:00–15:00 on that Friday, 18:00–20:00 against a TTh meeting).',
    citations: [MODEL, 'ADR-0010 §3'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-010',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'Only the second meetings overlap, on the exam day, and that is a conflict',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, EXAM_OVERLAP),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, EXAM_OVERLAP),
          sharedDates: EXAM_SHARED,
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale:
      'The weekly meetings never share a weekday, but 19:00–20:00 lies in both exam slots on Friday 2027-04-30, the only shared date of that pair. One meeting pair conflicts, so one issue.',
    citations: [MODEL, 'ADR-0010 §3'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-011',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'Only the first meetings overlap, all term, and that is a conflict',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, WEEKLY_OVERLAP),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, WEEKLY_OVERLAP),
          sharedDates: {
            firstDate: '2027-01-11',
            lastDate: '2027-05-07',
            weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
          },
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale:
      '09:30–09:50 lies in both MWF meetings on every MWF date of the term. The exam slots are apart from each other and from the other weekly meeting, so no other pair conflicts.',
    citations: [MODEL, 'ADR-0010 §3'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-012',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'Exam slots ending at 20:00 and starting at 20:00 fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, EXAM_ABUTS),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT, mustNot(CheckState.Unknown, 'one campus needs no transition')],
    rationale:
      'Times are half-open, so 18:00–20:00 and 20:00–21:00 share no minute, and both slots are on the north campus.',
    citations: [MODEL, 'ADR-0010 §8'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-013',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'Exam slots overlapping by one minute conflict',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, EXAM_ONE_MINUTE),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, EXAM_ONE_MINUTE),
          sharedDates: EXAM_SHARED,
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale: '19:59–20:00 lies in both exam slots on Friday 2027-04-30.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-MEET-014',
    family: GoldenScheduleFamily.MeetingOverlap,
    title: 'A proven exam-slot conflict beside a TBA meeting is a FAIL',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, TBA_AND_OVERLAP),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, TBA_AND_OVERLAP),
          sharedDates: EXAM_SHARED,
        },
      ]),
    ],
    prohibitedClaims: [
      CONFLICTS,
      mustNot(CheckState.Unknown, 'a proven conflict is not downgraded by an unrelated TBA time'),
    ],
    rationale:
      'The TBA Friday 2027-02-05 meeting shares that date with the MWF lecture, which is UNKNOWN on its own. The exam slots still overlap on 2027-04-30 (19:00–20:00), a proven conflict, and FAIL outranks UNKNOWN (planning/08 precedence).',
    citations: [MODEL, 'ADR-0010 §3 and Amendment 1'],
  }),
  meetingConflictCase({
    id: 'GC-TBA-007',
    family: GoldenScheduleFamily.MeetingTimeUnknown,
    title: 'A TBA second meeting on a date the other section meets is UNKNOWN',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LECTURE, TBA_FRIDAY),
    expected: [
      meetingCheck(CheckState.Unknown, [
        {
          reasonCode: ReasonCode.MeetingTimeUnknown,
          sectionIds: sectionIdsOf(LECTURE, TBA_FRIDAY),
        },
      ]),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'a time to be announced can’t prove a conflict'),
    ],
    rationale:
      'The TBA meeting’s only possible date, Friday 2027-02-05, is a date the MWF lecture meets, and its time is unknown. Its other pairings share no date (2027-04-30 is not 2027-02-05; TTh is not Friday), so there is one UNKNOWN issue.',
    citations: ['ADR-0010 Amendment 1 (ruling GR-02)'],
  }),
];
