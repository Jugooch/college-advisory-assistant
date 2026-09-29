/**
 * @file Private support for the schedule-issue schemas: wall-clock minute arithmetic, meeting
 *   comparisons, and the shared validation messages.
 * @module @caa/domain/models/schedule-issue-support
 * @requirement FR-10
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */

// NOTE: internal to `@caa/domain`. The package index doesn't re-export this file, so nothing
// here is a domain export or a shared invariant (ADR-0005); the engine keeps its own
// arithmetic and calls only the exported boolean invariants. It imports nothing, so any model
// file can use it without an import cycle.

/** Message for a FAIL issue that names a meeting whose days are to be announced. */
export const KNOWN_DAYS_MESSAGE = 'A FAIL issue names meetings whose days are known';

/** Message for shared or blocked days that a named meeting doesn't meet on. */
export const DAYS_SUBSET_MESSAGE = 'The weekdays shown must be days each named meeting meets on';

/**
 * Converts a local `HH:MM` time to minutes after midnight.
 *
 * @param time - A local time; `24:00` gives 1440. Malformed input gives `NaN`.
 * @returns Minutes after midnight, for example 570 for `09:30`.
 */
export function minutesOfLocalTime(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Returns the wall-clock minutes from one local time to another on the same date.
 *
 * @param from - The earlier time, such as the earlier meeting's end.
 * @param to - The later time, such as the later meeting's start.
 * @returns Minutes from `from` to `to`; negative when `to` is earlier.
 */
export function localTimeGapMinutes(from: string, to: string): number {
  return minutesOfLocalTime(to) - minutesOfLocalTime(from);
}

/**
 * Returns whether two references name the same meeting of the same section.
 *
 * @param first - One meeting.
 * @param second - The other meeting.
 * @returns `true` when the section and meeting index both match.
 */
export function isSameMeeting(
  first: { readonly sectionId: string; readonly meetingIndex: number },
  second: { readonly sectionId: string; readonly meetingIndex: number },
): boolean {
  return first.sectionId === second.sectionId && first.meetingIndex === second.meetingIndex;
}

/**
 * Returns whether a meeting can occur on every listed day. A meeting whose days are to be
 * announced could be on any day (GR-02), so it covers any list.
 *
 * @param ref - The meeting's known days, or `null` when to be announced.
 * @param days - Days the evidence says the meeting occurs on.
 * @returns `false` when a listed day isn't one of the meeting's known days.
 */
export function meetsOnDays(
  ref: { readonly weekdays: readonly string[] | null },
  days: readonly string[],
): boolean {
  const { weekdays } = ref;
  return weekdays === null || days.every((day) => weekdays.includes(day));
}
