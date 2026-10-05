/**
 * @file Checks the campus travel between two timed meetings that share a date and don't overlap.
 * @module @caa/engine/scheduling/compare-meeting-travel
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusId,
  type CampusTransitionPolicy,
  hasEnoughTransitionTime,
  type MeetingLocation,
  MeetingLocationKind,
  type SharedMeetingDates,
} from '@caa/domain';

import type { MeetingComparison, MeetingTransition, TimedMeeting } from './meeting-comparison';

/**
 * Checks the travel between two timed meetings on a shared date that don't overlap.
 *
 * @param pair - Both meetings in argument order, their shared dates, and the transition table.
 * @returns The travel outcome; a transition outcome says whether `first` is the earlier one.
 */
export function compareTravel(pair: {
  readonly first: TimedMeeting;
  readonly second: TimedMeeting;
  readonly sharedDates: SharedMeetingDates;
  readonly transitionPolicy: CampusTransitionPolicy | null;
}): MeetingComparison {
  const { first, second, sharedDates, transitionPolicy } = pair;
  const isFirstEarlier = minutesOf(first.range.startTime) < minutesOf(second.range.startTime);
  const [earlier, later] = isFirstEarlier ? [first, second] : [second, first];
  const trip = tripBetween(earlier.meeting.location, later.meeting.location);
  if (trip === 'NO_TRIP') {
    return { outcome: 'COMPATIBLE', sharedDates };
  }
  if (trip === 'UNKNOWN') {
    return { outcome: 'LOCATION_UNKNOWN', sharedDates };
  }
  const entry = transitionPolicy?.transitions.find(
    (candidate) => candidate.fromCampusId === trip.from && candidate.toCampusId === trip.to,
  );
  const transition: MeetingTransition = {
    fromCampusId: trip.from,
    toCampusId: trip.to,
    requiredMinutes: entry?.minutes ?? null,
    availableMinutes: minutesOf(later.range.startTime) - minutesOf(earlier.range.endTime),
  };
  // SAFETY: a pair the institution didn't configure, or a tenant with no table, is unknown
  // whatever the gap, never an assumed zero or a default (ADR-0010 §8; AC08).
  if (entry === undefined) {
    return { outcome: 'TRANSITION_UNDEFINED', sharedDates, transition, isFirstEarlier };
  }
  // SAFETY: the pair is ordered, from the earlier meeting's campus to the later one's, and a gap
  // exactly equal to the required time is enough. The rule is the domain's shared invariant
  // (ADR-0010 §8; AC08).
  if (!hasEnoughTransitionTime(transition.availableMinutes, entry)) {
    return { outcome: 'TRANSITION_INSUFFICIENT', sharedDates, transition, isFirstEarlier };
  }
  return { outcome: 'COMPATIBLE', sharedDates };
}

/**
 * Decides whether a trip between two campuses is needed from one meeting to the next.
 *
 * @param from - Location of the meeting that ends first, or `null` when to be announced.
 * @param to - Location of the meeting that starts next, or `null` when to be announced.
 * @returns The two different campuses, `NO_TRIP` when no transition applies, or `UNKNOWN`
 *   when a location to be announced decides it.
 */
function tripBetween(
  from: MeetingLocation | null,
  to: MeetingLocation | null,
): { readonly from: CampusId; readonly to: CampusId } | 'NO_TRIP' | 'UNKNOWN' {
  // SAFETY: an online meeting has no campus, so no trip leads to or from it (ADR-0010 §8 and
  // Amendment 2).
  if (from?.kind === MeetingLocationKind.Online || to?.kind === MeetingLocationKind.Online) {
    return 'NO_TRIP';
  }
  // SAFETY: a location to be announced may be another campus, so travel is UNKNOWN whatever
  // the gap, and it is never assumed to be the same campus (ADR-0010 Amendment 2).
  if (from === null || to === null) {
    return 'UNKNOWN';
  }
  // SAFETY: two meetings on the same campus need no transition (ADR-0010 §8).
  return from.campusId === to.campusId ? 'NO_TRIP' : { from: from.campusId, to: to.campusId };
}

/**
 * Converts a local `HH:MM` time to minutes after midnight, for ordering meetings and measuring
 * the gap between them. Neither is a shared rule: the domain's invariants decide overlap and
 * sufficiency.
 *
 * @param time - The local time.
 * @returns Minutes after midnight.
 */
function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
