/**
 * @file Turns the comparison of two section meetings into the schedule issue that explains it.
 * @module @caa/engine/scheduling/meeting-comparison-issue
 * @requirement FR-07
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  createScheduleIssue,
  type MeetingPattern,
  type MeetingTimeRef,
  ReasonCode,
  type ScheduleIssue,
  type SectionId,
} from '@caa/domain';

import type { MeetingComparison } from './compare-meetings';

/** One meeting of a section, with where it sits in the section's `meetings`. */
export interface SectionMeeting {
  readonly sectionId: SectionId;
  readonly meetingIndex: number;
  readonly meeting: MeetingPattern;
}

/**
 * Builds the reference an issue shows for a meeting, copying its weekdays and times.
 *
 * @param entry - The meeting and where it sits.
 * @returns The meeting reference; `null` fields stay `null` (to be announced).
 */
export function toMeetingTimeRef(entry: SectionMeeting): MeetingTimeRef {
  const { meeting } = entry;
  return {
    sectionId: entry.sectionId,
    meetingIndex: entry.meetingIndex,
    weekdays: meeting.weekdays,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
  };
}

/**
 * Maps a comparison of two meetings to its schedule issue.
 *
 * @param comparison - What `compareMeetings(first.meeting, second.meeting)` found.
 * @param first - The first meeting, named first in a conflict.
 * @param second - The second meeting.
 * @returns The validated issue, or `null` when the meetings are compatible or share no date.
 */
export function toMeetingComparisonIssue(
  comparison: MeetingComparison,
  first: SectionMeeting,
  second: SectionMeeting,
): ScheduleIssue | null {
  switch (comparison.outcome) {
    case 'NO_SHARED_DATE':
    case 'COMPATIBLE':
      return null;
    case 'OVERLAP':
      return createScheduleIssue({
        reasonCode: ReasonCode.MeetingConflict,
        first: toMeetingTimeRef(first),
        second: toMeetingTimeRef(second),
        sharedDates: comparison.sharedDates,
      });
    case 'TIME_UNKNOWN':
    case 'LOCATION_UNKNOWN':
      return unknownMeetingIssue(comparison, first, second);
    case 'TRANSITION_UNDEFINED':
    case 'TRANSITION_INSUFFICIENT':
      return transitionIssue(comparison, first, second);
  }
}

/**
 * Maps an unknown time or location to its issue, naming the meeting with the missing data.
 *
 * @param comparison - The `TIME_UNKNOWN` or `LOCATION_UNKNOWN` outcome.
 * @param first - One meeting.
 * @param second - The other meeting.
 * @returns The validated issue.
 */
function unknownMeetingIssue(
  comparison: Extract<MeetingComparison, { readonly outcome: 'TIME_UNKNOWN' | 'LOCATION_UNKNOWN' }>,
  first: SectionMeeting,
  second: SectionMeeting,
): ScheduleIssue {
  const isTime = comparison.outcome === 'TIME_UNKNOWN';
  // SAFETY: the issue names the meeting whose days, time, or location is to be announced, so
  // the UNKNOWN points at the missing data (GR-02; ADR-0010 Amendments 1 and 2).
  const isFirstUnknown = isTime
    ? hasUnknownTimeOrDays(first.meeting)
    : first.meeting.location === null;
  const [unknown, other] = isFirstUnknown ? [first, second] : [second, first];
  return createScheduleIssue({
    reasonCode: isTime ? ReasonCode.MeetingTimeUnknown : ReasonCode.MeetingLocationUnknown,
    meeting: toMeetingTimeRef(unknown),
    otherMeeting: toMeetingTimeRef(other),
    sharedDates: comparison.sharedDates,
    constraintIndex: null,
  });
}

/**
 * Maps a transition outcome to its issue, earlier meeting first.
 *
 * @param comparison - The transition outcome.
 * @param first - One meeting.
 * @param second - The other meeting.
 * @returns The validated issue.
 */
function transitionIssue(
  comparison: Extract<MeetingComparison, { readonly transition: unknown }>,
  first: SectionMeeting,
  second: SectionMeeting,
): ScheduleIssue {
  const [earlier, later] = comparison.isFirstEarlier ? [first, second] : [second, first];
  const { transition, sharedDates } = comparison;
  const fields = {
    earlier: toMeetingTimeRef(earlier),
    later: toMeetingTimeRef(later),
    sharedDates,
    fromCampusId: transition.fromCampusId,
    toCampusId: transition.toCampusId,
    availableMinutes: transition.availableMinutes,
  };
  // SAFETY: an unconfigured pair carries `requiredMinutes: null`, never 0 (ADR-0010 §8; AC08).
  if (transition.requiredMinutes === null) {
    return createScheduleIssue({
      reasonCode: ReasonCode.TransitionTimeUndefined,
      ...fields,
      requiredMinutes: null,
    });
  }
  return createScheduleIssue({
    reasonCode: ReasonCode.TransitionTimeInsufficient,
    ...fields,
    requiredMinutes: transition.requiredMinutes,
  });
}

/**
 * Returns whether a meeting's days or time are to be announced.
 *
 * @param meeting - The meeting.
 * @returns `true` when its weekdays or times are `null`.
 */
function hasUnknownTimeOrDays(meeting: MeetingPattern): boolean {
  return meeting.weekdays === null || meeting.startTime === null;
}
