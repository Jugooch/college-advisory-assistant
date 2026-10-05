/**
 * @file Golden cases: two timed meetings on one campus by weekday, time, excluded dates, and a
 *   daylight-saving change (#218). Planned as GC-MEET-001–008 in
 *   `tests/golden/scheduling.golden.test.ts`.
 * @module @caa/test-kit/golden/cases/meeting-overlap
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
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
const MWF = [Weekday.Monday, Weekday.Wednesday, Weekday.Friday];
const FAMILY = GoldenScheduleFamily.MeetingOverlap;
const REQUIREMENTS = ['FR-07', 'T05'];
const MODEL = 'planning/08 §Schedule model';
const NO_CONFLICT = mustNot(CheckState.Fail, 'must not report a conflict no meeting instance has');
const CONFLICTS = mustNot(CheckState.Pass, 'must not pass meetings that overlap on a shared date');
/** From Monday 2027-03-08, across the 2027-03-14 daylight-saving change, to the term end. */
const AFTER_BREAK = { startsOn: '2027-03-08' };

/**
 * Builds a whole-term section with one timed meeting.
 *
 * @param courseId - The course.
 * @param seed - The section seed.
 * @param meeting - Weekdays and local times.
 * @returns The section.
 */
function timed(
  courseId: string,
  seed: number,
  meeting: { weekdays: readonly Weekday[]; startTime: string; endTime: string },
): ReturnType<typeof scheduleSection> {
  return scheduleSection(courseId, seed, { meeting });
}

const MWF_1000 = timed(math102.id, 2001, { weekdays: MWF, startTime: '10:00', endTime: '10:50' });
const WF_1030 = timed(phys201.id, 2002, {
  weekdays: [Weekday.Wednesday, Weekday.Friday],
  startTime: '10:30',
  endTime: '11:20',
});
const MWF_0900 = scheduleSection(math102.id, 2003);
const TTH_0900 = timed(phys201.id, 2004, {
  weekdays: [Weekday.Tuesday, Weekday.Thursday],
  startTime: '09:00',
  endTime: '09:50',
});
const MWF_0950 = timed(phys201.id, 2005, { weekdays: MWF, startTime: '09:50', endTime: '10:40' });
const MWF_0900_0951 = timed(math102.id, 2006, {
  weekdays: MWF,
  startTime: '09:00',
  endTime: '09:51',
});
const SATURDAY = { weekdays: [Weekday.Saturday], startTime: '10:00', endTime: '12:00' };
const ONE_SATURDAY = scheduleSection(math102.id, 2007, {
  meeting: { ...SATURDAY, startsOn: '2027-02-13', endsOn: '2027-02-13' },
});
const SATURDAYS_EXCEPT_FEB_13 = scheduleSection(phys201.id, 2008, {
  meeting: { ...SATURDAY, excludedDates: ['2027-02-13'] },
});
const EVERY_SATURDAY = scheduleSection(phys201.id, 2009, { meeting: SATURDAY });
const LATE_0900 = scheduleSection(math102.id, 2010, { section: AFTER_BREAK });
const LATE_1000 = scheduleSection(phys201.id, 2011, {
  meeting: { startTime: '10:00', endTime: '10:50' },
  section: AFTER_BREAK,
});
const LATE_0930 = scheduleSection(phys201.id, 2012, {
  meeting: { startTime: '09:30', endTime: '10:20' },
  section: AFTER_BREAK,
});

/** Development cases for the MEETING_OVERLAP family. */
export const MEETING_OVERLAP_CASES: readonly GoldenCase[] = [
  meetingConflictCase({
    id: 'GC-MEET-001',
    family: FAMILY,
    title: 'MWF 10:00–10:50 and WF 10:30–11:20 conflict on Wednesdays and Fridays',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(MWF_1000, WF_1030),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(MWF_1000, WF_1030),
          sharedDates: {
            firstDate: '2027-01-13',
            lastDate: '2027-05-07',
            weekdays: ['FRIDAY', 'WEDNESDAY'],
          },
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale:
      '10:30–10:50 lies in both meetings on every Wednesday and Friday. The shared dates run from the first Wednesday, 2027-01-13, to the last Friday, 2027-05-07; Mondays are not shared.',
    citations: [MODEL, 'ADR-0010 §3'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-002',
    family: FAMILY,
    title: 'MWF and TTh at the same time never meet on the same day',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(MWF_0900, TTH_0900),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale: 'The meetings share no weekday, so no meeting instance overlaps.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-MEET-003',
    family: FAMILY,
    title: 'A meeting ending at 09:50 and one starting at 09:50 on one campus fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(MWF_0900, MWF_0950),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT, mustNot(CheckState.Unknown, 'one campus needs no transition')],
    rationale:
      'Times are half-open, so 09:00–09:50 and 09:50–10:40 share no minute; both are on the north campus.',
    citations: [MODEL, 'ADR-0010 §8'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-004',
    family: FAMILY,
    title: 'One minute of overlap is a conflict',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(MWF_0900_0951, MWF_0950),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(MWF_0900_0951, MWF_0950),
          sharedDates: {
            firstDate: '2027-01-11',
            lastDate: '2027-05-07',
            weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
          },
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale: '09:50–09:51 lies in both meetings on every MWF date of the term.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-MEET-005',
    family: FAMILY,
    title: 'A one-day Saturday meeting on a date the weekly one excludes fits',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(ONE_SATURDAY, SATURDAYS_EXCEPT_FEB_13),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale:
      'The only date the one-day meeting has, 2027-02-13, is excluded from the weekly one.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-MEET-006',
    family: FAMILY,
    title: 'The same one-day Saturday meeting conflicts when the date is not excluded',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(ONE_SATURDAY, EVERY_SATURDAY),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(ONE_SATURDAY, EVERY_SATURDAY),
          sharedDates: { firstDate: '2027-02-13', lastDate: '2027-02-13', weekdays: ['SATURDAY'] },
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale: 'Both meet 10:00–12:00 on Saturday 2027-02-13, the only shared date.',
    citations: [MODEL],
  }),
  meetingConflictCase({
    id: 'GC-MEET-007',
    family: FAMILY,
    title: 'Back-to-back hours across the DST change still fit',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LATE_0900, LATE_1000),
    expected: [MEETING_PASS],
    prohibitedClaims: [NO_CONFLICT],
    rationale:
      'Local wall-clock times never shift at the 2027-03-14 change, so 09:00–09:50 and 10:00–10:50 never overlap.',
    citations: [MODEL, 'ADR-0010 §8 (local wall-clock minutes)'],
  }),
  meetingConflictCase({
    id: 'GC-MEET-008',
    family: FAMILY,
    title: 'Overlapping meetings conflict on both sides of the DST change',
    requirementIds: REQUIREMENTS,
    inputs: meetingInputs(LATE_0900, LATE_0930),
    expected: [
      meetingCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LATE_0900, LATE_0930),
          sharedDates: {
            firstDate: '2027-03-08',
            lastDate: '2027-05-07',
            weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
          },
        },
      ]),
    ],
    prohibitedClaims: [CONFLICTS],
    rationale:
      '09:30–09:50 lies in both meetings on every MWF date from 2027-03-08, before and after 2027-03-14.',
    citations: [MODEL],
  }),
];
