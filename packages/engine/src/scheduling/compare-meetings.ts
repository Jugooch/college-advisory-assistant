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
  doLocalTimeRangesOverlap,
  hasEnoughTransitionTime,
  type LocalTimeRange,
  type MeetingLocation,
  MeetingLocationKind,
  type MeetingPattern,
  type SharedMeetingDates,
} from '@caa/domain';

import { findSharedMeetingDates } from './shared-meeting-dates';

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
 * - `TIME_UNKNOWN`: a shared date, and either time is to be announced, or a meeting whose days
 *   are to be announced would otherwise overlap or fall short of travel time.
 * - `OVERLAP`: a shared date, and the half-open time intervals intersect.
 * - `LOCATION_UNKNOWN`: a shared date, no overlap, and a location that decides whether travel
 *   is needed is to be announced.
 * - `TRANSITION_UNDEFINED`: different campuses on a shared date with no configured time.
 * - `TRANSITION_INSUFFICIENT`: the gap is shorter than the configured time.
 * - `COMPATIBLE`: a shared date with no overlap and no travel shortfall.
 */
export type MeetingComparison =
  | { readonly outcome: 'NO_SHARED_DATE' }
  | { readonly outcome: 'TIME_UNKNOWN'; readonly sharedDates: SharedMeetingDates }
  | { readonly outcome: 'OVERLAP'; readonly sharedDates: SharedMeetingDates }
  | { readonly outcome: 'LOCATION_UNKNOWN'; readonly sharedDates: SharedMeetingDates }
  | { readonly outcome: 'COMPATIBLE'; readonly sharedDates: SharedMeetingDates }
  | {
      readonly outcome: 'TRANSITION_UNDEFINED' | 'TRANSITION_INSUFFICIENT';
      readonly sharedDates: SharedMeetingDates;
      readonly transition: MeetingTransition;
      /** Whether the first argument is the earlier meeting. */
      readonly isFirstEarlier: boolean;
    };

/** A meeting whose start and end times are known. */
interface TimedMeeting {
  readonly meeting: MeetingPattern;
  readonly range: LocalTimeRange;
}

/**
 * Compares two meetings of the same section snapshot.
 *
 * Times are local wall-clock times in the snapshot's one time zone, compared on the same
 * calendar date, so a daylight-saving change never moves a meeting. The result doesn't depend
 * on the argument order.
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
  // SAFETY: a meeting whose days are to be announced may not meet on any shared date at all,
  // so it can leave a conflict or a travel shortfall UNKNOWN but never prove a FAIL (GR-02;
  // ADR-0010 Amendment 1). Compatible times stay compatible on every possible day.
  const hasUnknownDays = first.weekdays === null || second.weekdays === null;
  if (
    hasUnknownDays &&
    (result.outcome === 'OVERLAP' || result.outcome === 'TRANSITION_INSUFFICIENT')
  ) {
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
  const { first, second, sharedDates, transitionPolicy } = pair;
  // SAFETY: meetings are half-open intervals, so one ending exactly when the other starts
  // doesn't overlap, and an overlap is a conflict whatever the locations (planning/08
  // §Schedule model; ADR-0010 Amendment 2). The rule is the domain's shared invariant.
  if (doLocalTimeRangesOverlap(first.range, second.range)) {
    return { outcome: 'OVERLAP', sharedDates };
  }
  const isFirstEarlier = minutesOf(first.range.startTime) < minutesOf(second.range.startTime);
  const [earlier, later] = isFirstEarlier ? [first, second] : [second, first];
  return compareTravel({ earlier, later, isFirstEarlier, sharedDates, transitionPolicy });
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
  readonly isFirstEarlier: boolean;
  readonly sharedDates: SharedMeetingDates;
  readonly transitionPolicy: CampusTransitionPolicy | null;
}): MeetingComparison {
  const { earlier, later, isFirstEarlier, sharedDates, transitionPolicy } = pair;
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
 * Reads a meeting's time range.
 *
 * @param meeting - The meeting.
 * @returns The timed meeting, or `null` when its times are to be announced.
 */
function timed(meeting: MeetingPattern): TimedMeeting | null {
  if (meeting.startTime === null || meeting.endTime === null) {
    return null;
  }
  return { meeting, range: { startTime: meeting.startTime, endTime: meeting.endTime } };
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
