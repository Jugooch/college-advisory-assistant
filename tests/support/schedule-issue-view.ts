/**
 * @file Reads the engine's schedule issues (#266) the way a golden case states them: the reason,
 *   every section named in ascending order, and only the proving facts the case asserts, with
 *   shared weekdays sorted. So a case is compared on what the adjudicator wrote, not on fields it
 *   leaves open, such as meeting indexes or local times.
 * @module @caa/tests/support/schedule-issue-view
 * @see docs/standards/07-testing.md
 */
import type { ScheduleIssue } from '@caa/domain';
import type { ExpectedScheduleIssue } from '@caa/test-kit';

/** Facts an expected issue may state, besides its reason and sections. */
const FACT_KEYS = [
  'courseId',
  'sharedDates',
  'fromCampusId',
  'toCampusId',
  'requiredMinutes',
  'availableMinutes',
  'constraintIndex',
] as const;

/** Fields of an issue that name a section, directly or through a meeting reference. */
const SECTION_FIELDS = [
  'first',
  'second',
  'earlier',
  'later',
  'meeting',
  'otherMeeting',
  'sectionId',
  'primarySectionId',
] as const;

/**
 * Lists every section an issue names, ascending.
 *
 * @param issue - The engine's issue.
 * @returns The distinct section IDs.
 */
function sectionIdsNamed(issue: ScheduleIssue): readonly string[] {
  const fields = issue as Readonly<Record<string, unknown>>;
  const ids = SECTION_FIELDS.flatMap((field) => {
    const value = fields[field];
    if (typeof value === 'string') {
      return [value];
    }
    const ref = value as { readonly sectionId?: unknown } | null | undefined;
    return typeof ref?.sectionId === 'string' ? [ref.sectionId] : [];
  });
  return [...new Set(ids)].sort();
}

/**
 * Reads one fact the way a case writes it: shared weekdays sorted, everything else as is.
 *
 * @param key - The fact.
 * @param value - The engine's value.
 * @returns The comparable value.
 */
function factView(key: (typeof FACT_KEYS)[number], value: unknown): unknown {
  if (key !== 'sharedDates' || value === null || typeof value !== 'object') {
    return value;
  }
  const dates = value as { firstDate: string; lastDate: string; weekdays: readonly string[] };
  return {
    firstDate: dates.firstDate,
    lastDate: dates.lastDate,
    weekdays: [...dates.weekdays].sort(),
  };
}

/**
 * Projects the engine's issues onto the shape of the expected ones, in order. An issue beyond
 * the expected list keeps every fact, so the length difference shows what was extra.
 *
 * @param expected - The issues the case states.
 * @param actual - The issues the engine returned.
 * @returns One comparable view per returned issue.
 */
export function viewScheduleIssues(
  expected: readonly ExpectedScheduleIssue[],
  actual: readonly ScheduleIssue[],
): readonly unknown[] {
  return actual.map((issue, index) => {
    const stated = expected[index];
    const fields = issue as Readonly<Record<string, unknown>>;
    const facts = FACT_KEYS.filter((key) =>
      stated === undefined ? key in fields : stated[key] !== undefined,
    ).map((key): [string, unknown] => [key, factView(key, fields[key])]);
    const view: Record<string, unknown> = {
      reasonCode: issue.reasonCode,
      sectionIds: sectionIdsNamed(issue),
      ...Object.fromEntries(facts),
    };
    return view;
  });
}
