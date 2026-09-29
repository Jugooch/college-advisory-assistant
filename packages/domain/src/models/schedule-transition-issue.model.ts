/**
 * @file Transition schedule issues: travel between two campuses that falls short or is undefined.
 * @module @caa/domain/models/schedule-transition-issue
 * @requirement FR-07
 * @requirement FR-10
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { ReasonCode } from '../enums/reason-code.enum';
import { CampusIdSchema } from './campus.model';
import { hasEnoughTransitionTime } from './campus-transition-policy.model';
import {
  type MeetingTimeRef,
  MeetingTimeRefSchema,
  SharedMeetingDatesSchema,
} from './schedule-issue-parts.model';
import {
  DAYS_SUBSET_MESSAGE,
  isSameMeeting,
  KNOWN_DAYS_MESSAGE,
  localTimeGapMinutes,
  meetsOnDays,
} from './schedule-issue-support.model';

/**
 * Fields of a transition issue: two timed meetings on different campuses that share a date,
 * the earlier one ending no later than the later one starts (ADR-0010 §8).
 */
const TRANSITION_FIELDS = {
  earlier: MeetingTimeRefSchema,
  later: MeetingTimeRefSchema,
  sharedDates: SharedMeetingDatesSchema,
  /** Campus of the earlier meeting. */
  fromCampusId: CampusIdSchema,
  /** Campus of the later meeting; always a different campus. */
  toCampusId: CampusIdSchema,
  /** Whole minutes from the earlier meeting's end to the later meeting's start. */
  availableMinutes: z.number().int().nonnegative(),
};

/**
 * Returns whether a transition's meetings, campuses, and available minutes agree.
 *
 * @param transition - The transition's meetings, campuses, and gap.
 * @returns `false` when the campuses match, the meetings are the same, a meeting is untimed,
 *   the meetings overlap, or the available minutes differ from the gap between them.
 */
function isConsistentTransition(transition: {
  readonly earlier: MeetingTimeRef;
  readonly later: MeetingTimeRef;
  readonly fromCampusId: string;
  readonly toCampusId: string;
  readonly availableMinutes: number;
}): boolean {
  const { earlier, later } = transition;
  if (earlier.endTime === null || later.startTime === null) return false;
  const gap = localTimeGapMinutes(earlier.endTime, later.startTime);
  return (
    transition.fromCampusId !== transition.toCampusId &&
    !isSameMeeting(earlier, later) &&
    gap >= 0 &&
    gap === transition.availableMinutes
  );
}

/**
 * Returns whether both meetings meet on every day the evidence says they share.
 *
 * @param transition - The two meetings and their shared dates.
 * @returns `false` when a shared weekday isn't one of a meeting's known days.
 */
function sharesListedDays(transition: {
  readonly earlier: MeetingTimeRef;
  readonly later: MeetingTimeRef;
  readonly sharedDates: { readonly weekdays: readonly string[] };
}): boolean {
  const days = transition.sharedDates.weekdays;
  return meetsOnDays(transition.earlier, days) && meetsOnDays(transition.later, days);
}

/** The gap is shorter than the institution's required travel time (AC08). */
export const TransitionInsufficientIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.TransitionTimeInsufficient),
    ...TRANSITION_FIELDS,
    /** The institution's required minutes for this ordered campus pair. */
    requiredMinutes: z.number().int().nonnegative(),
  })
  // SAFETY: the minutes shown must prove the FAIL: less time available than required (AC08;
  // ADR-0010 §8).
  .refine(
    (transition) =>
      isConsistentTransition(transition) &&
      !hasEnoughTransitionTime(transition.availableMinutes, {
        minutes: transition.requiredMinutes,
      }),
    { message: 'An insufficient transition has availableMinutes below requiredMinutes' },
  )
  // SAFETY: a meeting whose days are to be announced could meet on any day or none of them, so
  // it can only leave travel UNKNOWN, never prove a FAIL (GR-02; planning/08 §Schedule model).
  .refine(({ earlier, later }) => earlier.weekdays !== null && later.weekdays !== null, {
    message: KNOWN_DAYS_MESSAGE,
  })
  // SAFETY: the evidence may only claim a shortfall on days both meetings meet (FR-10).
  .refine(sharesListedDays, { message: DAYS_SUBSET_MESSAGE })
  .readonly();

/** The institution hasn't configured the travel time for this ordered campus pair. */
export const TransitionUndefinedIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.TransitionTimeUndefined),
    ...TRANSITION_FIELDS,
    /** Always `null`: no required time is configured, and it is never assumed to be zero. */
    requiredMinutes: z.null(),
  })
  // SAFETY: an unconfigured pair is UNKNOWN whatever the gap, never an assumed zero (ADR-0010
  // §8; AC08), and the facts beside it must still describe a real transition.
  .refine(isConsistentTransition, {
    message: 'A transition names two timed, non-overlapping meetings on different campuses',
  })
  .refine(sharesListedDays, { message: DAYS_SUBSET_MESSAGE })
  .readonly();
