/**
 * @file The normalized form of a schedule-options request, for its pinned hash: canonical JSON
 * that is the same for two requests asking the same thing in another order.
 * @module @caa/engine/scheduling/normalize-schedule-request
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { CourseId, ScheduleConstraint, TermId } from '@caa/domain';

import { compareText } from './tie-break-key';

/** One chosen credit value for a variable-credit course, in hundredths of a credit. */
export interface NormalizableCreditSelection {
  readonly courseId: CourseId;
  readonly selectedCreditsHundredths: number;
}

/** The fields of a schedule-options request that its pinned hash covers. */
export interface NormalizableScheduleRequest {
  readonly termId: TermId;
  readonly courseIds: readonly CourseId[];
  readonly creditSelections: readonly NormalizableCreditSelection[];
  readonly constraints: readonly ScheduleConstraint[];
}

/**
 * Serializes a JSON value with every object's keys sorted by UTF-16 code unit, never by locale,
 * so equal values always give equal text. Array order is kept.
 *
 * @param value - A JSON value: no functions, `undefined`, or cycles.
 * @returns The canonical JSON text.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([first], [second]) =>
      compareText(first, second),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Normalizes a schedule-options request for its pinned hash (ADR-0010 §7): the term, the courses
 * sorted, the credit choices sorted by course, the hard constraints sorted by their canonical
 * JSON, and the preferences sorted by rank. Two requests that ask the same thing in another
 * order normalize to the same text; the caller hashes it.
 *
 * @param request - The validated request.
 * @returns The canonical JSON of the normalized request.
 */
export function normalizeScheduleRequest(request: NormalizableScheduleRequest): string {
  const hard = request.constraints.filter((constraint) => constraint.priorityRank === null);
  const preferences = request.constraints.filter((constraint) => constraint.priorityRank !== null);
  return canonicalJson({
    termId: request.termId,
    courseIds: request.courseIds.toSorted(compareText),
    creditSelections: request.creditSelections.toSorted((first, second) =>
      compareText(first.courseId, second.courseId),
    ),
    hardConstraints: hard.toSorted((first, second) =>
      compareText(canonicalJson(first), canonicalJson(second)),
    ),
    // SAFETY: preference ranks are distinct (domain constraint-set schema), so sorting by rank
    // keeps the student's priority order and swapping two ranks changes the hash (planning/08
    // §Constraint formulation: student priority ordering must be inspectable).
    preferences: preferences.toSorted(
      (first, second) => (first.priorityRank ?? 0) - (second.priorityRank ?? 0),
    ),
  });
}
