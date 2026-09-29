/**
 * @file Parts of schedule issues: a reference to one meeting, timed or to be announced, the
 *   dates two meetings share, and the issue shapes that need no cross-field rule.
 * @module @caa/domain/models/schedule-issue-parts
 * @requirement FR-10
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { ReasonCode } from '../enums/reason-code.enum';
import { SectionModalitySchema } from '../enums/section-modality.enum';
import { WeekdaySchema } from '../enums/weekday.enum';
import { CampusIdSchema } from './campus.model';
import { CourseIdSchema } from './course.model';
import { LocalTimeSchema } from './meeting-pattern.model';
import { SectionIdSchema } from './section.model';

/** Schema for an index into the request's constraint list. */
export const ConstraintIndexSchema = z.number().int().nonnegative();

/** Schema for a non-empty list of distinct weekdays. */
export const WeekdayListSchema = z
  .array(WeekdaySchema)
  .min(1)
  .readonly()
  .refine((weekdays) => new Set(weekdays).size === weekdays.length, {
    message: 'weekdays must not repeat a day',
  });

/**
 * Schema for one meeting named in a schedule issue: the section, the index into its
 * `meetings`, and the weekdays and local time range shown beside the issue, copied from the
 * meeting. The weekdays are `null` when the days are to be announced, and the times are `null`
 * together when the time is to be announced.
 */
export const MeetingTimeRefSchema = z
  .object({
    sectionId: SectionIdSchema,
    /** Index of the meeting in the section's `meetings`. */
    meetingIndex: z.number().int().nonnegative(),
    /** Days the meeting recurs on, or `null` when the days are to be announced. */
    weekdays: WeekdayListSchema.nullable(),
    /** Local start time, or `null` when to be announced. */
    startTime: LocalTimeSchema.nullable(),
    /** Local end time, exclusive, or `null` when to be announced. */
    endTime: LocalTimeSchema.nullable(),
  })
  .refine((ref) => (ref.startTime === null) === (ref.endTime === null), {
    message: 'startTime and endTime must both be set or both be null',
    path: ['endTime'],
  })
  .refine((ref) => ref.startTime === null || ref.endTime === null || ref.startTime < ref.endTime, {
    message: 'startTime must be earlier than endTime',
    path: ['endTime'],
  })
  .readonly();

/** A validated, immutable meeting reference. */
export type MeetingTimeRef = z.infer<typeof MeetingTimeRefSchema>;

/**
 * Schema for the dates two meetings can both occur on, summarized as the engine computes them:
 * the first and last shared date and every weekday with a shared date.
 */
export const SharedMeetingDatesSchema = z
  .object({
    // NOTE: date-only on purpose (docs/standards/04 rule 7): calendar dates in the
    // institution's calendar.
    /** Earliest shared date, `YYYY-MM-DD`. */
    firstDate: z.iso.date(),
    /** Latest shared date, `YYYY-MM-DD`. Inclusive. */
    lastDate: z.iso.date(),
    /** Every weekday with at least one shared date. */
    weekdays: WeekdayListSchema,
  })
  .refine((dates) => dates.firstDate <= dates.lastDate, {
    message: 'firstDate must not be later than lastDate',
    path: ['lastDate'],
  })
  .readonly();

/** Validated, immutable shared meeting dates. */
export type SharedMeetingDates = z.infer<typeof SharedMeetingDatesSchema>;

/** A section's delivery mode is outside the student's hard allowed modalities. */
export const ModalityNotAllowedIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.ModalityNotAllowed),
    sectionId: SectionIdSchema,
    modality: SectionModalitySchema,
    constraintIndex: ConstraintIndexSchema,
  })
  .readonly();

/** A meeting is on a campus outside the student's hard allowed campuses. */
export const CampusNotAllowedIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.CampusNotAllowed),
    sectionId: SectionIdSchema,
    meetingIndex: z.number().int().nonnegative(),
    campusId: CampusIdSchema,
    constraintIndex: ConstraintIndexSchema,
  })
  .readonly();

/** A section requires a linked component for which no section was published. */
export const LinkedSectionUnavailableIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.LinkedSectionUnavailable),
    /** The section whose required component has no permitted section. */
    primarySectionId: SectionIdSchema,
    /** Display name of the component, such as `Lab`. */
    componentName: z.string().min(1),
    /** Course the component's sections would belong to. */
    courseId: CourseIdSchema,
  })
  .readonly();

/** A requested course has no section in the published section data. */
export const SectionDataMissingIssueSchema = z
  .object({
    reasonCode: z.literal(ReasonCode.SectionDataMissing),
    /** The requested course with no section in the published section data. */
    courseId: CourseIdSchema,
  })
  .readonly();
