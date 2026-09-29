/**
 * @file Compares two recurring meetings for a time overlap or a campus transition shortfall on a shared date.
 * @module @caa/engine/scheduling/compare-meetings
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type CampusId,
  type CampusTransitionPolicy,
  type MeetingLocation,
  MeetingLocationKind,
  type MeetingPattern,
} from '@caa/domain';

import { findSharedMeetingDates, type SharedMeetingDates } from './shared-meeting-dates';

/** The travel between two timed meetings on different campuses, earlier meeting first. */
export interface MeetingTransition {
  /** Campus of the meeting that ends first. */
  readonly fromCampusId: CampusId;
  /** Campus of the meeting that starts next. */
  readonly toCampusId: CampusId;
  /** Minutes the institution requires for the trip, or `null` when its table has no entry. */
  readonly requiredMinutes: number | null;
  /** Local wall-clock minutes from the earlier meeting's end to the later one's start. */
  readonly availableMinutes: number;
}

/**
 * What comparing two meetings found. It carries facts only; the check that reports them maps
 * each outcome to a state and reason code.
 * - `NO_SHARED_DATE`: no date on which both can occur, so no instance can coincide.
 * - `TIME_UNKNOWN`: a shared date, and either time is to be announced.
 * - `OVERLAP`: a shared date, and the half-open time intervals intersect.
 * - `LOCATION_UNKNOWN`: a shared date, no overlap, and a location that decides whether travel
 *   is needed is to be announced.
 * - `TRANSITION_UNDEFINED`: different campuses on a shared date with no configured time.
 * - `TRANSITION_INSUFFICIENT`: the gap is shorter than the configured time.
 * - `COMPATIBLE`: a shared date with no overlap and no travel shortfall.
 */
export type MeetingComparison =
  | { readonly outcome: 'NO_SHARED_DATE' }
  | {
      readonly outcome: 'TIME_UNKNOWN' | 'OVERLAP' | 'LOCATION_UNKNOWN' | 'COMPATIBLE';
      readonly sharedDates: SharedMeetingDates;
    }
  | {
      readonly outcome: 'TRANSITION_UNDEFINED' | 'TRANSITION_INSUFFICIENT';
      readonly sharedDates: SharedMeetingDates;
      readonly transition: MeetingTransition;
    };

/** A meeting whose start and end times are known, with both as minutes after midnight. */
interface TimedMeeting {
  readonly meeting: MeetingPattern;
  readonly start: number;
  readonly end: number;
}

/**
 * Compares two meetings of the same section snapshot.
 *
 * Times are local wall-clock times in the snapshot's one time zone, compared as minutes after
 * midnight on the same calendar date, so a daylight-saving change never moves a meeting. The
 * result doesn't depend on the argument order.
 *
 * @param first - One meeting.
 * @param second - The other meeting.
 * @param transitionPolicy - The tenant's campus transition table.
 * @returns What the comparison found.
 */
export function compareMeetings(
  first: MeetingPattern,
  second: MeetingPattern,
  transitionPolicy: CampusTransitionPolicy,
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
  // is reported as unknown, never as compatible (GR-02; planning/08 §Schedule model: unknown
  // meeting times can't satisfy a hard constraint).
  if (timedFirst === null || timedSecond === null) {
    return { outcome: 'TIME_UNKNOWN', sharedDates };
  }
  const [earlier, later] =
    timedFirst.start <= timedSecond.start ? [timedFirst, timedSecond] : [timedSecond, timedFirst];
  // SAFETY: meetings are half-open intervals, so one ending exactly when the other starts
  // doesn't overlap (planning/08 §Schedule model).
  if (later.start < earlier.end) {
    return { outcome: 'OVERLAP', sharedDates };
  }
  return compareTravel({ earlier, later, sharedDates, transitionPolicy });
}

/**
 * Checks the travel between two timed meetings on a shared date that don't overlap.
 *
 * @param pair - The earlier and later meetings, their shared dates, and the transition table.
 * @returns The travel outcome.
 */
function compareTravel(pair: {
  readonly earlier: TimedMeeting;
  readonly later: TimedMeeting;
  readonly sharedDates: SharedMeetingDates;
  readonly transitionPolicy: CampusTransitionPolicy;
}): MeetingComparison {
  const { earlier, later, sharedDates, transitionPolicy } = pair;
  const trip = tripBetween(earlier.meeting.location, later.meeting.location);
  if (trip === 'NO_TRIP') {
    return { outcome: 'COMPATIBLE', sharedDates };
  }
  if (trip === 'UNKNOWN') {
    return { outcome: 'LOCATION_UNKNOWN', sharedDates };
  }
  const entry = transitionPolicy.transitions.find(
    (candidate) => candidate.fromCampusId === trip.from && candidate.toCampusId === trip.to,
  );
  const transition: MeetingTransition = {
    fromCampusId: trip.from,
    toCampusId: trip.to,
    requiredMinutes: entry?.minutes ?? null,
    availableMinutes: later.start - earlier.end,
  };
  // SAFETY: a pair the institution didn't configure is unknown whatever the gap, never an
  // assumed zero or a default (ADR-0010 §8; AC08).
  if (transition.requiredMinutes === null) {
    return { outcome: 'TRANSITION_UNDEFINED', sharedDates, transition };
  }
  // SAFETY: the pair is ordered, from the earlier meeting's campus to the later one's, and a gap
  // exactly equal to the required time is enough (ADR-0010 §8; AC08).
  if (transition.availableMinutes < transition.requiredMinutes) {
    return { outcome: 'TRANSITION_INSUFFICIENT', sharedDates, transition };
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
  // SAFETY: an online meeting has no campus, so no trip leads to or from it (ADR-0010 §8).
  if (from?.kind === MeetingLocationKind.Online || to?.kind === MeetingLocationKind.Online) {
    return 'NO_TRIP';
  }
  // SAFETY: a location to be announced may be another campus, so whether travel is needed is
  // unknown, and it is never assumed to be the same campus (planning/08 §Authority and result
  // semantics: missing data is UNKNOWN).
  if (from === null || to === null) {
    return 'UNKNOWN';
  }
  // SAFETY: two meetings on the same campus need no transition (ADR-0010 §8).
  return from.campusId === to.campusId ? 'NO_TRIP' : { from: from.campusId, to: to.campusId };
}

/**
 * Reads a meeting's times as minutes after midnight.
 *
 * @param meeting - The meeting.
 * @returns The timed meeting, or `null` when its times are to be announced.
 */
function timed(meeting: MeetingPattern): TimedMeeting | null {
  if (meeting.startTime === null || meeting.endTime === null) {
    return null;
  }
  return { meeting, start: minutesOf(meeting.startTime), end: minutesOf(meeting.endTime) };
}

/**
 * Converts a local `HH:MM` time to minutes after midnight.
 *
 * @param time - The local time.
 * @returns Minutes after midnight.
 */
function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
