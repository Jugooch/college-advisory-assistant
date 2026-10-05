/**
 * @file Finds the calendar dates on which two recurring meetings can both occur.
 * @module @caa/engine/scheduling/shared-meeting-dates
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { MeetingPattern, SharedMeetingDates, Weekday } from '@caa/domain';

import { calendarDateOf, dayNumberOf, weekdayIndexOf, WEEKDAYS_IN_ORDER } from './calendar-date';

/** The fields of a meeting that decide on which dates it can occur. */
export type MeetingDates = Pick<
  MeetingPattern,
  'weekdays' | 'startsOn' | 'endsOn' | 'excludedDates'
>;

/** First and last shared day numbers on one weekday. */
interface WeekdaySpan {
  readonly weekday: Weekday;
  readonly first: number;
  readonly last: number;
}

/**
 * Finds the dates on which both meetings can occur.
 *
 * A meeting's possible dates are the dates from `startsOn` to `endsOn`, less its
 * `excludedDates`, that fall on one of its weekdays. When its weekdays are to be announced
 * (`null`), every weekday counts (GR-02). Two meetings can only overlap on a date in both sets.
 *
 * The work is bounded by the input size: for each weekday the search skips at most one run of
 * excluded dates from each end, never the whole interval.
 *
 * @param first - One meeting's dates.
 * @param second - The other meeting's dates.
 * @returns The shared dates, or `null` when the meetings have no date in common.
 */
export function findSharedMeetingDates(
  first: MeetingDates,
  second: MeetingDates,
): SharedMeetingDates | null {
  const start = Math.max(dayNumberOf(first.startsOn), dayNumberOf(second.startsOn));
  const end = Math.min(dayNumberOf(first.endsOn), dayNumberOf(second.endsOn));
  // SAFETY: a date excluded by either meeting is a date on which that meeting doesn't occur,
  // so it can't host a shared meeting instance (planning/08 §Schedule model: exceptions).
  const excluded = new Set(
    [...first.excludedDates, ...second.excludedDates].map((date) => dayNumberOf(date)),
  );
  const spans = WEEKDAYS_IN_ORDER.flatMap((weekday, index) => {
    // SAFETY: to-be-announced weekdays could be any day, so they never rule a date out
    // (GR-02; ADR-0010 Amendment 1). Treating them as "no day" would hide a possible conflict.
    if (!meetsOn(first, weekday) || !meetsOn(second, weekday)) {
      return [];
    }
    return spanOn({ weekday, index, start, end, excluded });
  });
  if (spans.length === 0) {
    return null;
  }
  const firstDay = Math.min(...spans.map((span) => span.first));
  const lastDay = Math.max(...spans.map((span) => span.last));
  return {
    firstDate: calendarDateOf(firstDay),
    lastDate: calendarDateOf(lastDay),
    weekdays: spans.map((span) => span.weekday),
  };
}

/**
 * Returns whether a meeting can occur on a weekday.
 *
 * @param meeting - The meeting's dates.
 * @param weekday - The weekday.
 * @returns `true` when the weekday is listed, or the weekdays are to be announced.
 */
function meetsOn(meeting: MeetingDates, weekday: Weekday): boolean {
  return meeting.weekdays === null || meeting.weekdays.includes(weekday);
}

/**
 * Finds the first and last non-excluded day on one weekday within `[start, end]`.
 *
 * @param search - The weekday, its index, the inclusive day range, and the excluded days.
 * @returns The span, or an empty list when every such day is excluded or none exists.
 */
function spanOn(search: {
  readonly weekday: Weekday;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly excluded: ReadonlySet<number>;
}): WeekdaySpan[] {
  const { weekday, index, start, end, excluded } = search;
  let first = start + ((index - weekdayIndexOf(start) + 7) % 7);
  while (first <= end && excluded.has(first)) {
    first += 7;
  }
  if (first > end) {
    return [];
  }
  let last = end - ((weekdayIndexOf(end) - index + 7) % 7);
  // NOTE: `first` is a non-excluded day on this weekday within the range, so the backward
  // search stops at it at the latest.
  while (excluded.has(last)) {
    last -= 7;
  }
  return [{ weekday, first, last }];
}
