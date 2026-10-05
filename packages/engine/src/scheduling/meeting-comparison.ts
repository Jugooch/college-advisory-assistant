/**
 * @file Result types of comparing two meetings: the outcome, the shared dates and any campus trip.
 * @module @caa/engine/scheduling/meeting-comparison
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { CampusId, LocalTimeRange, MeetingPattern, SharedMeetingDates } from '@caa/domain';

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
export interface TimedMeeting {
  readonly meeting: MeetingPattern;
  readonly range: LocalTimeRange;
}
