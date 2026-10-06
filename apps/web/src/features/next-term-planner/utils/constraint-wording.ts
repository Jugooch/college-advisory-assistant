/**
 * @file Says each constraint in words with its strength, for the review step. Wording only: the
 * constraint is shown as parsed, never changed.
 * @module @caa/web/features/next-term-planner/utils/constraint-wording
 * @requirement FR-08
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { ConstraintStrength, type ScheduleConstraint, ScheduleConstraintKind } from '@caa/domain';

import { formatCredits } from '@/shared/utils/format-display';

/** One constraint as the review step lists it. */
export interface ReviewedConstraint {
  /** What the constraint says, as a sentence. */
  readonly statement: string;
  /** How strict it is, in words: "Required" or "Preferred, priority 2". */
  readonly strength: string;
}

/**
 * Turns an enum value such as `ONLINE_SYNCHRONOUS` into text such as `online synchronous`.
 *
 * @param value - The enum value.
 * @returns Lower-case words.
 */
function toWords(value: string): string {
  return value.toLowerCase().replaceAll('_', ' ');
}

/**
 * Says a time of day, writing `24:00` as the end of the day.
 *
 * @param time - An `HH:MM` time or `24:00`.
 * @returns The time text.
 */
function describeTime(time: string): string {
  return time === '24:00' ? 'midnight' : time;
}

/**
 * Says an unavailable-time block. The whole day reads as "all day", so "no Fridays" says so.
 *
 * @param constraint - An unavailable-time constraint.
 * @returns The sentence.
 */
function describeUnavailable(
  constraint: Extract<ScheduleConstraint, { kind: 'UNAVAILABLE_TIME' }>,
): string {
  const days = constraint.weekdays.map((day) => toWords(day)).join(', ');
  const isAllDay = constraint.startTime === '00:00' && constraint.endTime === '24:00';
  const when = isAllDay
    ? 'all day'
    : `from ${describeTime(constraint.startTime)} to ${describeTime(constraint.endTime)}`;
  return `Not available on ${days}, ${when}.`;
}

/**
 * Says a credit range.
 *
 * @param min - The lowest credits in hundredths, or null.
 * @param max - The highest credits in hundredths, or null.
 * @returns The sentence.
 */
function describeCreditRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `Take between ${formatCredits(min)} and ${formatCredits(max)} credits.`;
  }
  return min === null
    ? `Take at most ${formatCredits(max ?? 0)} credits.`
    : `Take at least ${formatCredits(min)} credits.`;
}

/**
 * Says the constraint's own statement.
 *
 * @param constraint - The constraint.
 * @returns The sentence.
 */
function describeStatement(constraint: ScheduleConstraint): string {
  switch (constraint.kind) {
    case ScheduleConstraintKind.UnavailableTime:
      return describeUnavailable(constraint);
    case ScheduleConstraintKind.CreditRange:
      return describeCreditRange(constraint.minCreditsHundredths, constraint.maxCreditsHundredths);
    case ScheduleConstraintKind.AllowedModalities:
      return `Only these formats: ${constraint.modalities.map((value) => toWords(value)).join(', ')}.`;
    case ScheduleConstraintKind.AllowedCampuses:
      return `Only these campuses: ${constraint.campusIds.join(', ')}.`;
  }
}

/**
 * Describes every constraint in words, in the order stated.
 *
 * @param constraints - The parsed constraints.
 * @returns One review line per constraint.
 */
export function describeConstraints(
  constraints: readonly ScheduleConstraint[],
): readonly ReviewedConstraint[] {
  return constraints.map((constraint) => ({
    statement: describeStatement(constraint),
    strength:
      constraint.strength === ConstraintStrength.Hard
        ? 'Required'
        : `Preferred, priority ${String(constraint.priorityRank)}`,
  }));
}
