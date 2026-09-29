/**
 * @file Builds synthetic section meeting patterns for tests: weekly, half-term and TBA meetings.
 * @module @caa/test-kit/builders/meeting-pattern
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  createMeetingPattern,
  MeetingLocationKind,
  type MeetingPattern,
  type MeetingPatternInput,
  Weekday,
} from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../fixtures/synthetic-campuses';
import {
  SYNTHETIC_SCHEDULE_TERM,
  type SyntheticTermHalf,
} from '../fixtures/synthetic-schedule-term';

/**
 * Builds a valid weekly meeting: Monday, Wednesday and Friday, 09:00 to 09:50, every week of
 * `SYNTHETIC_SCHEDULE_TERM` (2027-01-11 to 2027-05-07) with no excluded dates, on
 * `SYNTHETIC_CAMPUSES.north` with no room assigned.
 *
 * The default never avoids a conflict silently: two default meetings overlap on every meeting
 * day. A test that needs two meetings apart states the times it relies on.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated meeting pattern.
 */
export function buildMeetingPattern(overrides: Partial<MeetingPatternInput> = {}): MeetingPattern {
  return createMeetingPattern({
    weekdays: [Weekday.Monday, Weekday.Wednesday, Weekday.Friday],
    startTime: '09:00',
    endTime: '09:50',
    startsOn: SYNTHETIC_SCHEDULE_TERM.startsOn,
    endsOn: SYNTHETIC_SCHEDULE_TERM.endsOn,
    excludedDates: [],
    location: {
      kind: MeetingLocationKind.OnCampus,
      campusId: SYNTHETIC_CAMPUSES.north.id,
      room: null,
    },
    ...overrides,
  });
}

/**
 * Builds a meeting that runs in one half of `SYNTHETIC_SCHEDULE_TERM`, otherwise like
 * {@link buildMeetingPattern}. The first half is 2027-01-11 to 2027-03-05 and the second is
 * 2027-03-08 to 2027-05-07, so a first-half and a second-half meeting at the same time share no
 * date (AC07).
 *
 * @param half - Which half of the term the meeting runs in.
 * @param overrides - Fields to replace in the default.
 * @returns A validated meeting pattern.
 */
export function buildHalfTermMeeting(
  half: SyntheticTermHalf,
  overrides: Partial<MeetingPatternInput> = {},
): MeetingPattern {
  return buildMeetingPattern({ ...SYNTHETIC_SCHEDULE_TERM.halves[half], ...overrides });
}

/**
 * Builds a meeting whose days, times and location are all to be announced, over the whole of
 * `SYNTHETIC_SCHEDULE_TERM`. A TBA meeting is unknown, never "no meeting": it can't satisfy a
 * hard availability constraint (planning/08 §Schedule model).
 *
 * @param overrides - Fields to replace in the default, for example known days with unknown times.
 * @returns A validated meeting pattern.
 */
export function buildTbaMeeting(overrides: Partial<MeetingPatternInput> = {}): MeetingPattern {
  return buildMeetingPattern({
    weekdays: null,
    startTime: null,
    endTime: null,
    location: null,
    ...overrides,
  });
}
