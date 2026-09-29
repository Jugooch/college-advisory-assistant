/**
 * @file Meeting pattern data object: when and where one recurring meeting of a section happens.
 * @module @caa/domain/models/meeting-pattern
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { MeetingLocationKind } from '../enums/section-modality.enum';
import { WeekdaySchema } from '../enums/weekday.enum';
import { CampusIdSchema } from './campus.model';

/**
 * Returns whether no value appears twice.
 *
 * @param values - Values to check.
 * @returns `false` when any value repeats.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** Schema for a local wall-clock time, `HH:MM` on a 24-hour clock, with no date or offset. */
export const LocalTimeSchema = z.iso.time({ precision: -1 });

/**
 * A local wall-clock interval, `[startTime, endTime)`, as `HH:MM` strings on one calendar date.
 * `endTime` may be `24:00`, the end of the day, for an unavailable-time block.
 */
export interface LocalTimeRange {
  readonly startTime: string;
  readonly endTime: string;
}

/**
 * Converts a local `HH:MM` time to minutes after midnight.
 *
 * @param time - A local time; `24:00` gives 1440.
 * @returns Minutes after midnight, for example 570 for `09:30`.
 */
function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Returns whether two local time ranges overlap as half-open intervals, so one ending exactly
 * when the other starts doesn't overlap. Shared invariant (ADR-0005): the engine's meeting and
 * unavailable-time comparisons and the schedule-issue schema both call it.
 *
 * @param first - One range.
 * @param second - The other range.
 * @returns `true` when some minute lies in both ranges.
 */
export function doLocalTimeRangesOverlap(first: LocalTimeRange, second: LocalTimeRange): boolean {
  // SAFETY: meetings are half-open intervals, so back-to-back meetings don't conflict, while
  // required travel time can still rule them out (planning/08 §Schedule model).
  return (
    minutesOf(first.startTime) < minutesOf(second.endTime) &&
    minutesOf(second.startTime) < minutesOf(first.endTime)
  );
}

/**
 * Returns the wall-clock minutes from one local time to a later one on the same date: the
 * later meeting's start minus the earlier meeting's end. Negative when `to` is earlier. Shared
 * invariant (ADR-0005): the engine's transition check and the schedule-issue schema both call it.
 *
 * @param from - The earlier meeting's end time.
 * @param to - The later meeting's start time.
 * @returns Minutes from `from` to `to`.
 */
export function localTimeGapMinutes(from: string, to: string): number {
  // SAFETY: the gap is measured in local wall-clock minutes on one calendar date, so a
  // daylight-saving change never moves a meeting (ADR-0010 §8).
  return minutesOf(to) - minutesOf(from);
}

/** Schema for where a meeting takes place: on a campus, or online. */
export const MeetingLocationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal(MeetingLocationKind.OnCampus),
      campusId: CampusIdSchema,
      /** Room display text such as `SCI 204`, or `null` when the source hasn't assigned one. */
      room: z.string().min(1).nullable(),
    })
    .readonly(),
  z.object({ kind: z.literal(MeetingLocationKind.Online) }).readonly(),
]);

/** A validated, immutable meeting location. */
export type MeetingLocation = z.infer<typeof MeetingLocationSchema>;

/**
 * Schema for one recurring meeting of a section: its weekdays, local start and end time, the
 * dates it runs between, and the dates it doesn't meet.
 *
 * Times are local wall-clock times in the section snapshot's `timezone`. Meetings are half-open
 * intervals, so a meeting ending at 10:00 and one starting at 10:00 don't overlap. A `null`
 * weekday list, time, or location means "to be announced": unknown, never "no meeting". The
 * engine can't use an unknown value to satisfy a hard availability constraint.
 */
export const MeetingPatternSchema = z
  .object({
    /** Days the meeting recurs on, or `null` when the days are to be announced. */
    weekdays: z.array(WeekdaySchema).min(1).readonly().nullable(),
    /** Local start time, or `null` when the time is to be announced. */
    startTime: LocalTimeSchema.nullable(),
    /** Local end time, exclusive, or `null` when the time is to be announced. */
    endTime: LocalTimeSchema.nullable(),
    // NOTE: date-only on purpose (docs/standards/04 rule 7): meeting dates are calendar dates
    // in the institution's calendar, with no time of day, so an offset would fabricate data.
    /** First date the meeting can occur, `YYYY-MM-DD` in the institution's calendar. */
    startsOn: z.iso.date(),
    /** Last date the meeting can occur, `YYYY-MM-DD` in the institution's calendar. Inclusive. */
    endsOn: z.iso.date(),
    /** Dates in the interval on which the meeting doesn't occur, such as a holiday. */
    excludedDates: z.array(z.iso.date()).readonly(),
    /** Where the meeting takes place, or `null` when the location is to be announced. */
    location: MeetingLocationSchema.nullable(),
  })
  .refine((meeting) => meeting.weekdays === null || isDistinct(meeting.weekdays), {
    message: 'weekdays must not repeat a day',
    path: ['weekdays'],
  })
  // SAFETY: a meeting with only one end of its time known has no interval to check, so it must
  // be wholly to be announced rather than half-known.
  .refine((meeting) => (meeting.startTime === null) === (meeting.endTime === null), {
    message: 'startTime and endTime must both be set or both be null',
    path: ['endTime'],
  })
  // SAFETY: a meeting that ends before it starts has no interval, so an overlap check against it
  // would find no conflict where the real meeting may have one.
  // NOTE: `HH:MM` strings sort in time order, so a string comparison is exact here.
  .refine(
    (meeting) =>
      meeting.startTime === null || meeting.endTime === null || meeting.startTime < meeting.endTime,
    { message: 'startTime must be earlier than endTime', path: ['endTime'] },
  )
  // SAFETY: a date interval that ends before it starts has no meeting days, which would look
  // conflict-free.
  .refine((meeting) => meeting.startsOn <= meeting.endsOn, {
    message: 'startsOn must not be later than endsOn',
    path: ['endsOn'],
  })
  .refine(
    (meeting) =>
      isDistinct(meeting.excludedDates) &&
      meeting.excludedDates.every((date) => meeting.startsOn <= date && date <= meeting.endsOn),
    {
      message: 'excludedDates must be distinct dates between startsOn and endsOn',
      path: ['excludedDates'],
    },
  )
  .readonly();

/** A validated, immutable meeting pattern. */
export type MeetingPattern = z.infer<typeof MeetingPatternSchema>;

/** Raw input accepted by {@link createMeetingPattern}. */
export type MeetingPatternInput = z.input<typeof MeetingPatternSchema>;

/**
 * Creates a validated, immutable meeting pattern.
 *
 * @param input - Raw meeting fields.
 * @returns The parsed meeting pattern.
 * @throws {z.ZodError} When a field is invalid, a weekday repeats, only one time is set, the
 *   start time or date is not before the end, or an excluded date repeats or falls outside the
 *   meeting's dates.
 */
export function createMeetingPattern(input: MeetingPatternInput): MeetingPattern {
  return MeetingPatternSchema.parse(input);
}
