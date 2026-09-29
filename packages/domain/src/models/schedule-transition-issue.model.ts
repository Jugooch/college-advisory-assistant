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
import { localTimeGapMinutes } from './meeting-pattern.model';
import {
  type MeetingTimeRef,
  MeetingTimeRefSchema,
  SharedMeetingDatesSchema,
} from './schedule-issue-parts.model';

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
  const isSameMeeting =
    earlier.sectionId === later.sectionId && earlier.meetingIndex === later.meetingIndex;
  return (
    transition.fromCampusId !== transition.toCampusId &&
    !isSameMeeting &&
    gap >= 0 &&
    gap === transition.availableMinutes
  );
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
  .readonly();
