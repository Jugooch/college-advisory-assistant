/**
 * @file Days of the week on which a section meeting recurs.
 * @module @caa/domain/enums/weekday
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/** A day of the week, in the institution's calendar. */
export const Weekday = {
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
  Sunday: 'SUNDAY',
} as const;

/** Union of every {@link Weekday} value. */
export type Weekday = (typeof Weekday)[keyof typeof Weekday];

/** Runtime schema for {@link Weekday}. */
export const WeekdaySchema = z.enum(Weekday);
