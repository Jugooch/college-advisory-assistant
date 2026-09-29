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
import { SectionModalitySchema } from '../enums/section-modality.enum';
import { CampusIdSchema } from './campus.model';
import { CourseIdSchema } from './course.model';
import { LocalTimeSchema } from './meeting-pattern.model';
import {
  type MeetingTimeRef,
  MeetingTimeRefSchema,
  SharedMeetingDatesSchema,
  WeekdayListSchema,
} from './schedule-issue-parts.model';
import { SectionIdSchema } from './section.model';

/** Schema for an index into the request's constraint list. */
const ConstraintIndexSchema = z.number().int().nonnegative();

/**
 * Converts a validated local `HH:MM` time to minutes after midnight.
 *
 * @param time - A validated local time.
 * @returns Minutes after midnight, for example 570 for `09:30`.
 */
function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Returns whether two references name different meetings.
 *
 * @param first - One meeting.
 * @param second - The other meeting.
 * @returns `false` when both name the same meeting of the same section.
 */
function isDifferentMeeting(first: MeetingTimeRef, second: MeetingTimeRef): boolean {
  return first.sectionId !== second.sectionId || first.meetingIndex !== second.meetingIndex;
}

/** Two meetings overlap on a shared date (half-open intervals). */
const MeetingConflictSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.MeetingConflict),
    first: MeetingTimeRefSchema,
    second: MeetingTimeRefSchema,
    sharedDates: SharedMeetingDatesSchema,
  })
  // SAFETY: a conflict shown between a meeting and itself, or between untimed or disjoint
  // meetings, would explain a FAIL with facts that don't support it.
  .refine(
    ({ first, second }) =>
      isDifferentMeeting(first, second) &&
      first.startTime !== null &&
      first.endTime !== null &&
      second.startTime !== null &&
      second.endTime !== null &&
      first.startTime < second.endTime &&
      second.startTime < first.endTime,
    { message: 'A meeting conflict names two different, timed, overlapping meetings' },
  )
  .readonly();

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
 * @returns `false` when the campuses match, a meeting is untimed, the meetings overlap, or the
 *   available minutes differ from the gap between them.
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
  const gap = minutesOf(later.startTime) - minutesOf(earlier.endTime);
  return (
    transition.fromCampusId !== transition.toCampusId &&
    isDifferentMeeting(earlier, later) &&
    gap >= 0 &&
    gap === transition.availableMinutes
  );
}

/** The gap is shorter than the institution's required travel time (AC08). */
const TransitionInsufficientSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.TransitionTimeInsufficient),
    ...TRANSITION_FIELDS,
    /** The institution's required minutes for this ordered campus pair. */
    requiredMinutes: z.number().int().nonnegative(),
  })
  // SAFETY: the minutes shown must prove the FAIL: less time available than required.
  .refine(
    (transition) =>
      isConsistentTransition(transition) &&
      transition.availableMinutes < transition.requiredMinutes,
    { message: 'An insufficient transition has availableMinutes below requiredMinutes' },
  )
  .readonly();

/** The institution hasn't configured the travel time for this ordered campus pair. */
const TransitionUndefinedSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.TransitionTimeUndefined),
    ...TRANSITION_FIELDS,
    /** Always `null`: no required time is configured, and it is never assumed to be zero. */
    requiredMinutes: z.null(),
  })
  .refine(isConsistentTransition, {
    message: 'A transition names two timed, non-overlapping meetings on different campuses',
  })
  .readonly();

/**
 * A meeting's time or location is to be announced, so the check can't be decided. It is
 * compared either with another meeting on a shared date, or with a hard constraint.
 */
const UnknownMeetingSchema = z
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
  .refine(
    (issue) =>
      issue.otherMeeting === null
        ? issue.sharedDates === null && issue.constraintIndex !== null
        : issue.sharedDates !== null &&
          issue.constraintIndex === null &&
          isDifferentMeeting(issue.meeting, issue.otherMeeting),
    {
      message:
        'An unknown meeting is compared with another meeting and shared dates, or with a constraint',
    },
  )
  .readonly();

/** A meeting falls in a hard unavailable time block (half-open, like the block itself). */
const UnavailableTimeConflictSchema = z
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
  // SAFETY: the times shown must prove the FAIL: a timed meeting that intersects the block.
  .refine(
    ({ meeting, blockStartTime, blockEndTime }) =>
      meeting.startTime !== null &&
      meeting.endTime !== null &&
      meeting.startTime < blockEndTime &&
      blockStartTime < meeting.endTime,
    { message: 'An unavailable-time conflict names a timed meeting that overlaps the block' },
  )
  .readonly();

/**
 * Schema for one schedule issue: why a `SCHEDULE_FEASIBILITY` check isn't PASS, from
 * structured fields only, never free text (FR-10). The `reasonCode` decides the shape.
 * Meetings are named by section and index into that section's `meetings`, and constraints by
 * index into the request's constraint list.
 */
export const ScheduleIssueSchema = z.discriminatedUnion('reasonCode', [
  MeetingConflictSchema,
  TransitionInsufficientSchema,
  TransitionUndefinedSchema,
  UnknownMeetingSchema,
  UnavailableTimeConflictSchema,
  z
    .object({
      reasonCode: z.literal(ReasonCode.ModalityNotAllowed),
      sectionId: SectionIdSchema,
      modality: SectionModalitySchema,
      constraintIndex: ConstraintIndexSchema,
    })
    .readonly(),
  z
    .object({
      reasonCode: z.literal(ReasonCode.CampusNotAllowed),
      sectionId: SectionIdSchema,
      meetingIndex: z.number().int().nonnegative(),
      campusId: CampusIdSchema,
      constraintIndex: ConstraintIndexSchema,
    })
    .readonly(),
  z
    .object({
      reasonCode: z.literal(ReasonCode.LinkedSectionUnavailable),
      /** The section whose required component has no permitted section. */
      primarySectionId: SectionIdSchema,
      /** Display name of the component, such as `Lab`. */
      componentName: z.string().min(1),
      /** Course the component's sections would belong to. */
      courseId: CourseIdSchema,
    })
    .readonly(),
  z
    .object({
      reasonCode: z.literal(ReasonCode.SectionDataMissing),
      /** The requested course with no section in the published section data. */
      courseId: CourseIdSchema,
    })
    .readonly(),
]);

/** A validated, immutable schedule issue. */
export type ScheduleIssue = z.infer<typeof ScheduleIssueSchema>;

/** Raw input accepted by {@link createScheduleIssue}. */
export type ScheduleIssueInput = z.input<typeof ScheduleIssueSchema>;

/** Reason codes that have a {@link ScheduleIssue} shape. */
export type ScheduleReasonCode = ScheduleIssue['reasonCode'];

/**
 * The check state each schedule reason code means. A conflict proven on known data is FAIL;
 * a decision blocked by missing data is UNKNOWN, never PASS (ADR-0010 §3).
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
