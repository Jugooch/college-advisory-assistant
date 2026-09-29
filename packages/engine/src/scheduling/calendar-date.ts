/**
 * @file Converts `YYYY-MM-DD` calendar dates to and from day numbers, and finds their weekday, by integer arithmetic.
 * @module @caa/engine/scheduling/calendar-date
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { Weekday } from '@caa/domain';

/** Weekdays in calendar order, Monday first. A day number's weekday indexes into it. */
export const WEEKDAYS_IN_ORDER: readonly Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
  Weekday.Sunday,
];

/** Days in one 400-year Gregorian cycle. */
const DAYS_PER_ERA = 146_097;

/** Day number of 0000-03-01 counted from 1970-01-01, which is day 0. */
const EPOCH_SHIFT = 719_468;

/** Offset that makes day 0 (1970-01-01, a Thursday) land on Thursday in {@link WEEKDAYS_IN_ORDER}. */
const EPOCH_WEEKDAY_INDEX = 3;

/**
 * Returns the non-negative remainder of a division, so negative day numbers map correctly.
 *
 * @param value - The dividend.
 * @param divisor - A positive divisor.
 * @returns The remainder in `[0, divisor)`.
 */
function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/**
 * Converts a calendar date to its day number: whole days since 1970-01-01 in the proleptic
 * Gregorian calendar.
 *
 * The date is a calendar date in the institution's calendar with no time of day, so the result
 * doesn't depend on any time zone or on daylight saving (planning/08 §Schedule model).
 *
 * @param date - A valid `YYYY-MM-DD` date, as the domain schemas guarantee.
 * @returns The day number; 1970-01-01 is 0.
 */
export function dayNumberOf(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  // NOTE: the algorithm counts years from March, so January and February belong to the
  // previous year and a leap day is the last day of its year.
  const marchYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(marchYear / 400);
  const yearOfEra = marchYear - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT;
}

/**
 * Converts a day number back to its calendar date, the inverse of {@link dayNumberOf}.
 *
 * @param dayNumber - Whole days since 1970-01-01.
 * @returns The `YYYY-MM-DD` date.
 */
export function calendarDateOf(dayNumber: number): string {
  const shifted = dayNumber + EPOCH_SHIFT;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the position of a day's weekday in {@link WEEKDAYS_IN_ORDER}, Monday 0 to Sunday 6.
 *
 * @param dayNumber - Whole days since 1970-01-01.
 * @returns The weekday index.
 */
export function weekdayIndexOf(dayNumber: number): number {
  return modulo(dayNumber + EPOCH_WEEKDAY_INDEX, 7);
}
