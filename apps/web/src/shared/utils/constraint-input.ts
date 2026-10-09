/**
 * @file Reads the text a student types for a schedule constraint: time bounds, campus lists,
 * priority and credit bounds. Format only; the domain schema decides whether the constraint is
 * valid. The planner form and the chat's constraint chips both read input through here.
 * @module @caa/web/shared/utils/constraint-input
 * @requirement FR-08
 * @see docs/adr/0007-web-feature-and-shared-layout.md
 */
import { parseCreditText } from '@/shared/utils/credit-choice';

/** The start of the day, used when a time block has no start. */
export const DAY_START = '00:00';

/** The end of the day, used when a time block has no end. */
export const DAY_END = '24:00';

/** The lowest priority number that can be typed; 1 matters most. */
const MIN_RANK = 1;

/**
 * Reads the start and end of an unavailable time. A blank start means the start of the day and
 * a blank end means the end of the day.
 *
 * @param start - The typed start.
 * @param end - The typed end.
 * @returns The start and end times.
 */
export function readTimeBounds(
  start: string,
  end: string,
): { readonly startTime: string; readonly endTime: string } {
  return { startTime: start === '' ? DAY_START : start, endTime: end === '' ? DAY_END : end };
}

/**
 * Splits a typed campus list, separated by commas or spaces.
 *
 * @param text - The typed campus IDs.
 * @returns The non-empty IDs, in typed order.
 */
export function splitCampusIds(text: string): string[] {
  return text.split(/[\s,]+/).filter((id) => id !== '');
}

/**
 * Reads a typed priority: one or two digits, at least 1.
 *
 * @param text - The typed priority.
 * @returns The priority, or `null` when it isn't a whole number from 1 to 99.
 */
export function readPriorityRank(text: string): number | null {
  const rank = /^\d{1,2}$/.test(text) ? Number(text) : 0;
  return rank >= MIN_RANK ? rank : null;
}

/**
 * Reads one typed credit bound.
 *
 * @param text - The typed value.
 * @returns The hundredths, `null` when blank (no bound), or `undefined` when not a number.
 */
export function readCreditBound(text: string): number | null | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? null : (parseCreditText(trimmed) ?? undefined);
}
