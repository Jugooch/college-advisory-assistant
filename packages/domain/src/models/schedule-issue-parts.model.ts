/**
 * @file Parts of schedule issues: a reference to one timed meeting, and the dates two meetings share.
 * @module @caa/domain/models/schedule-issue-parts
 * @requirement FR-10
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { WeekdaySchema } from '../enums/weekday.enum';
import { LocalTimeSchema } from './meeting-pattern.model';
import { SectionIdSchema } from './section.model';

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
 * `meetings`, and the local time range shown beside the issue. The times are `null` together
 * when the meeting's time is to be announced.
 */
export const MeetingTimeRefSchema = z
  .object({
    sectionId: SectionIdSchema,
    /** Index of the meeting in the section's `meetings`. */
    meetingIndex: z.number().int().nonnegative(),
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
