/**
 * @file Compares two recurring meetings for a time overlap or a campus transition shortfall on a shared date.
 * @module @caa/engine/scheduling/compare-meetings
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusTransitionPolicy,
  doLocalTimeRangesOverlap,
  type MeetingPattern,
  type SharedMeetingDates,
} from '@caa/domain';

import { compareTravel } from './compare-meeting-travel';
import type { MeetingComparison, TimedMeeting } from './meeting-comparison';
import { findSharedMeetingDates } from './shared-meeting-dates';

/**
 * Compares two meetings of the same section snapshot.
 *
 * Times are local wall-clock times in the snapshot's one time zone, compared on the same
 * calendar date, so a daylight-saving change never moves a meeting. Swapping the arguments
 * gives the same outcome, shared dates and transition; only `isFirstEarlier` on a transition
 * outcome flips, because it describes the argument order.
 *
 * @param first - One meeting.
 * @param second - The other meeting.
 * @param transitionPolicy - The tenant's campus transition table, or `null` when it has none,
 *   so every pair of different campuses is undefined.
 * @returns What the comparison found.
 */
export function compareMeetings(
  first: MeetingPattern,
  second: MeetingPattern,
  transitionPolicy: CampusTransitionPolicy | null,
): MeetingComparison {
  const sharedDates = findSharedMeetingDates(first, second);
  // SAFETY: meetings with no possible date in common can't overlap whatever their times, and
  // travel between them is never needed (planning/08 §Schedule model: both calendar intervals
  // and meeting instances must overlap; GR-02; ADR-0010 Amendment 1).
  if (sharedDates === null) {
    return { outcome: 'NO_SHARED_DATE' };
  }
  const timedFirst = timed(first);
  const timedSecond = timed(second);
  // SAFETY: an unknown time on a shared date can neither prove nor rule out a conflict, so it
  // is reported as unknown, never as compatible or conflicting (GR-02; ADR-0010 Amendment 1).
  if (timedFirst === null || timedSecond === null) {
    return { outcome: 'TIME_UNKNOWN', sharedDates };
  }
  const result = compareTimed({
    first: timedFirst,
    second: timedSecond,
    sharedDates,
    transitionPolicy,
  });
  const hasUnknownDays = first.weekdays === null || second.weekdays === null;
  return hasUnknownDays ? withUnknownDays(result, sharedDates) : result;
}

/**
 * Limits what a comparison involving a meeting whose days are to be announced can prove.
 *
 * @param result - The comparison of the two meetings' times.
 * @param sharedDates - The dates the meetings may share.
 * @returns `TIME_UNKNOWN` in place of a conflict or travel shortfall; any other result as is.
 */
function withUnknownDays(
  result: MeetingComparison,
  sharedDates: SharedMeetingDates,
): MeetingComparison {
  // SAFETY: a meeting whose days are to be announced may not meet on any shared date at all,
  // so it can leave a conflict or a travel shortfall UNKNOWN but never prove a FAIL (GR-02;
  // ADR-0010 Amendment 1). Compatible times stay compatible on every possible day.
  if (result.outcome === 'OVERLAP' || result.outcome === 'TRANSITION_INSUFFICIENT') {
    return { outcome: 'TIME_UNKNOWN', sharedDates };
  }
  return result;
}

/**
 * Compares two timed meetings on a shared date.
 *
 * @param pair - Both timed meetings, the dates they share, and the transition table or `null`.
 * @returns The overlap or travel outcome.
 */
function compareTimed(pair: {
  readonly first: TimedMeeting;
  readonly second: TimedMeeting;
  readonly sharedDates: SharedMeetingDates;
  readonly transitionPolicy: CampusTransitionPolicy | null;
}): MeetingComparison {
  // SAFETY: meetings are half-open intervals, so one ending exactly when the other starts
  // doesn't overlap, and an overlap is a conflict whatever the locations (planning/08
  // §Schedule model; ADR-0010 Amendment 2). The rule is the domain's shared invariant.
  if (doLocalTimeRangesOverlap(pair.first.range, pair.second.range)) {
    return { outcome: 'OVERLAP', sharedDates: pair.sharedDates };
  }
  return compareTravel(pair);
}

/**
 * Reads a meeting's time range.
 *
 * @param meeting - The meeting.
 * @returns The timed meeting, or `null` when either time is to be announced.
 */
function timed(meeting: MeetingPattern): TimedMeeting | null {
  if (meeting.startTime === null || meeting.endTime === null) {
    return null;
  }
  return { meeting, range: { startTime: meeting.startTime, endTime: meeting.endTime } };
}
