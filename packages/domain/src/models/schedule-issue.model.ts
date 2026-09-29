/**
 * @file Schedule issue: the structured evidence behind one non-passing schedule-feasibility result.
 * @module @caa/domain/models/schedule-issue
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { CheckState } from '../enums/check-state.enum';
import { ReasonCode } from '../enums/reason-code.enum';
import {
  doLocalTimeRangesOverlap,
  type LocalTimeRange,
  LocalTimeSchema,
} from './meeting-pattern.model';
import {
  CampusNotAllowedIssueSchema,
  ConstraintIndexSchema,
  LinkedSectionUnavailableIssueSchema,
  type MeetingTimeRef,
  MeetingTimeRefSchema,
  ModalityNotAllowedIssueSchema,
  SectionDataMissingIssueSchema,
  SharedMeetingDatesSchema,
  WeekdayListSchema,
} from './schedule-issue-parts.model';
import {
  DAYS_SUBSET_MESSAGE,
  isSameMeeting,
  KNOWN_DAYS_MESSAGE,
  localTimeGapMinutes,
  meetsOnDays,
} from './schedule-issue-support.model';
import {
  TransitionInsufficientIssueSchema,
  TransitionUndefinedIssueSchema,
} from './schedule-transition-issue.model';

/**
 * Returns a meeting's time range, when it is timed.
 *
 * @param ref - The meeting.
 * @returns Its local range, or `null` when its time is to be announced.
 */
function rangeOf(ref: MeetingTimeRef): LocalTimeRange | null {
  return ref.startTime === null || ref.endTime === null
    ? null
    : { startTime: ref.startTime, endTime: ref.endTime };
}

/** Two meetings overlap on a shared date (half-open intervals). */
const MeetingConflictIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.MeetingConflict),
    first: MeetingTimeRefSchema,
    second: MeetingTimeRefSchema,
    sharedDates: SharedMeetingDatesSchema,
  })
  // SAFETY: a conflict shown between a meeting and itself, or between untimed or disjoint
  // meetings, would explain a FAIL with facts that don't support it (planning/08 §Schedule
  // model: half-open intervals).
  .refine(
    ({ first, second }) => {
      const firstRange = rangeOf(first);
      const secondRange = rangeOf(second);
      return (
        !isSameMeeting(first, second) &&
        firstRange !== null &&
        secondRange !== null &&
        doLocalTimeRangesOverlap(firstRange, secondRange)
      );
    },
    { message: 'A meeting conflict names two different, timed, overlapping meetings' },
  )
  // SAFETY: a meeting whose days are to be announced could meet on any day or none of them, so
  // it can only leave a conflict UNKNOWN, never prove a FAIL (GR-02; planning/08 §Schedule model).
  .refine(({ first, second }) => first.weekdays !== null && second.weekdays !== null, {
    message: KNOWN_DAYS_MESSAGE,
  })
  // SAFETY: the evidence may only claim a conflict on days both meetings actually meet (FR-10).
  .refine(
    ({ first, second, sharedDates }) =>
      meetsOnDays(first, sharedDates.weekdays) && meetsOnDays(second, sharedDates.weekdays),
    { message: DAYS_SUBSET_MESSAGE },
  )
  .readonly();

/**
 * A meeting's days, time, or location is to be announced, so the check can't be decided. It is
 * compared either with another meeting on a shared date, or with a hard constraint.
 */
const UnknownMeetingIssueSchema = z
  .object({
    reasonCode: z.enum([ReasonCode.MeetingTimeUnknown, ReasonCode.MeetingLocationUnknown]),
    /** The meeting whose time or location is to be announced. */
    meeting: MeetingTimeRefSchema,
    /** The meeting it couldn't be compared with, or `null` when compared with a constraint. */
    otherMeeting: MeetingTimeRefSchema.nullable(),
    /** Dates the two meetings share, or `null` when compared with a constraint. */
    sharedDates: SharedMeetingDatesSchema.nullable(),
    /** The hard constraint it couldn't be checked against, or `null` for a meeting pair. */
    constraintIndex: ConstraintIndexSchema.nullable(),
  })
  // SAFETY: missing data is UNKNOWN, and the UNKNOWN must name what it couldn't be compared
  // with: another meeting on a shared date, or a hard constraint (planning/08 §Schedule model;
  // ADR-0010 Amendments 1 and 2).
  .refine(
    (issue) =>
      issue.otherMeeting === null
        ? issue.sharedDates === null && issue.constraintIndex !== null
        : issue.sharedDates !== null &&
          issue.constraintIndex === null &&
          !isSameMeeting(issue.meeting, issue.otherMeeting),
    {
      message:
        'An unknown meeting is compared with another meeting and shared dates, or with a constraint',
    },
  )
  // SAFETY: an unknown time must be explained by a meeting whose days or time are actually to
  // be announced, so the evidence never contradicts its own reason (FR-10; GR-02).
  .refine(
    (issue) =>
      issue.reasonCode !== ReasonCode.MeetingTimeUnknown ||
      rangeOf(issue.meeting) === null ||
      issue.meeting.weekdays === null,
    { message: 'MEETING_TIME_UNKNOWN names a meeting whose days or time are to be announced' },
  )
  // SAFETY: an overlap is FAIL MEETING_CONFLICT whatever the locations, because the times alone
  // prove it, so a TBA location only leaves two timed, non-overlapping meetings UNKNOWN
  // (ADR-0010 Amendment 2).
  .refine(
    (issue) => {
      if (issue.reasonCode !== ReasonCode.MeetingLocationUnknown || issue.otherMeeting === null) {
        return true;
      }
      const range = rangeOf(issue.meeting);
      const otherRange = rangeOf(issue.otherMeeting);
      return range !== null && otherRange !== null && !doLocalTimeRangesOverlap(range, otherRange);
    },
    { message: 'MEETING_LOCATION_UNKNOWN names two timed meetings that do not overlap' },
  )
  .refine(
    ({ meeting, otherMeeting, sharedDates }) =>
      otherMeeting === null ||
      sharedDates === null ||
      (meetsOnDays(meeting, sharedDates.weekdays) &&
        meetsOnDays(otherMeeting, sharedDates.weekdays)),
    { message: DAYS_SUBSET_MESSAGE },
  )
  .readonly();

/** A meeting falls in a hard unavailable time block (half-open, like the block itself). */
const UnavailableTimeConflictIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.UnavailableTimeConflict),
    meeting: MeetingTimeRefSchema,
    constraintIndex: ConstraintIndexSchema,
    /** Days both the meeting and the block cover. */
    weekdays: WeekdayListSchema,
    /** The block's local start, inclusive. */
    blockStartTime: LocalTimeSchema,
    /** The block's local end, exclusive; `24:00` is the end of the day. */
    blockEndTime: z.union([LocalTimeSchema, z.literal('24:00')]),
  })
  .refine(
    ({ blockStartTime, blockEndTime }) => localTimeGapMinutes(blockStartTime, blockEndTime) > 0,
    {
      message: 'blockStartTime must be earlier than blockEndTime',
      path: ['blockEndTime'],
    },
  )
  // SAFETY: the times shown must prove the FAIL: a timed meeting that intersects the block
  // (planning/08 §Schedule model: half-open intervals).
  .refine(
    ({ meeting, blockStartTime, blockEndTime }) => {
      const range = rangeOf(meeting);
      return (
        range !== null &&
        doLocalTimeRangesOverlap(range, { startTime: blockStartTime, endTime: blockEndTime })
      );
    },
    { message: 'An unavailable-time conflict names a timed meeting that overlaps the block' },
  )
  // SAFETY: a meeting whose days are to be announced never proves it falls in a hard
  // unavailable time; it is UNKNOWN (GR-02; ADR-0010 §3).
  .refine(({ meeting }) => meeting.weekdays !== null, { message: KNOWN_DAYS_MESSAGE })
  // SAFETY: the evidence may only claim the conflict on days the meeting actually meets (FR-10).
  // NOTE: the block's own days are in the request, not the issue, so they're checked there.
  .refine(({ meeting, weekdays }) => meetsOnDays(meeting, weekdays), {
    message: DAYS_SUBSET_MESSAGE,
  })
  .readonly();

/**
 * Schema for one schedule issue: why a `SCHEDULE_FEASIBILITY` check isn't PASS, from
 * structured fields only, never free text (FR-10). The `reasonCode` decides the shape.
 * Meetings are named by section and index into that section's `meetings`, and constraints by
 * index into the request's constraint list.
 */
export const ScheduleIssueSchema = z.discriminatedUnion('reasonCode', [
  MeetingConflictIssueSchema,
  TransitionInsufficientIssueSchema,
  TransitionUndefinedIssueSchema,
  UnknownMeetingIssueSchema,
  UnavailableTimeConflictIssueSchema,
  ModalityNotAllowedIssueSchema,
  CampusNotAllowedIssueSchema,
  LinkedSectionUnavailableIssueSchema,
  SectionDataMissingIssueSchema,
]);

/** A validated, immutable schedule issue. */
export type ScheduleIssue = z.infer<typeof ScheduleIssueSchema>;

/** Raw input accepted by {@link createScheduleIssue}. */
export type ScheduleIssueInput = z.input<typeof ScheduleIssueSchema>;

/** Reason codes that have a {@link ScheduleIssue} shape. */
export type ScheduleReasonCode = ScheduleIssue['reasonCode'];

/**
 * The check state each schedule reason code means. A conflict proven on known data is FAIL;
 * a decision blocked by missing data is UNKNOWN, never PASS (ADR-0010 §3). No schedule reason
 * means CONDITIONAL, so a CONDITIONAL schedule check is never valid.
 */
export const SCHEDULE_REASON_STATE: Readonly<Record<ScheduleReasonCode, CheckState>> = {
  [ReasonCode.MeetingConflict]: CheckState.Fail,
  [ReasonCode.TransitionTimeInsufficient]: CheckState.Fail,
  [ReasonCode.TransitionTimeUndefined]: CheckState.Unknown,
  [ReasonCode.MeetingTimeUnknown]: CheckState.Unknown,
  [ReasonCode.MeetingLocationUnknown]: CheckState.Unknown,
  [ReasonCode.UnavailableTimeConflict]: CheckState.Fail,
  [ReasonCode.ModalityNotAllowed]: CheckState.Fail,
  [ReasonCode.CampusNotAllowed]: CheckState.Fail,
  [ReasonCode.LinkedSectionUnavailable]: CheckState.Unknown,
  [ReasonCode.SectionDataMissing]: CheckState.Unknown,
};

/**
 * Creates a validated, immutable schedule issue.
 *
 * @param input - Raw issue fields.
 * @returns The parsed schedule issue.
 * @throws {z.ZodError} When the reason code isn't a schedule code, a field is invalid, or the
 *   facts don't support the reason (for example meetings that don't overlap for a conflict).
 */
export function createScheduleIssue(input: ScheduleIssueInput): ScheduleIssue {
  return ScheduleIssueSchema.parse(input);
}
