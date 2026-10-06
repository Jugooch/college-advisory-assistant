/**
 * @file Builds the course-checks request from the query: the selected courses and the credit
 * values typed for variable-credit courses, each within the catalog range.
 * @module @caa/web/features/course-checks/utils/check-request-plan
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { ApiError } from '@caa/api-contract';
import { type AcademicSummaryResponse, type CourseChecksRequest } from '@caa/api-contract';

import { summaryCourses } from '@/shared/utils/course-display';
import { planCreditSelections } from '@/shared/utils/credit-selections';

import type { CourseCheckQuery } from './course-check-query';

/** What the page sends, or why it sends nothing. */
export interface CheckRequestPlan {
  /** The request, or null when no valid selection was submitted or a credit value was rejected. */
  readonly request: CourseChecksRequest | null;
  /** Why a typed credit value was rejected, by course ID. */
  readonly creditErrors: ReadonlyMap<string, string>;
}

/**
 * Plans the request. Only a course whose catalog rule is VARIABLE takes a credit value. A blank
 * value is left out, so the credit-load check reports it as unknown; no value is ever assumed.
 *
 * @param query - The parsed query.
 * @param summary - The summary, whose display entries carry each course's credit rule.
 * @returns The request, or the credit errors that stop it.
 */
export function planCheckRequest(
  query: CourseCheckQuery,
  summary: AcademicSummaryResponse | ApiError,
): CheckRequestPlan {
  if (query.selection.kind !== 'valid') {
    return { request: null, creditErrors: new Map() };
  }
  const { courseIds } = query.selection.request;
  const { selections, errors } = planCreditSelections(
    courseIds,
    query.creditInputs,
    summaryCourses(summary),
  );
  if (errors.size > 0) {
    return { request: null, creditErrors: errors };
  }
  return {
    request: selections.length === 0 ? { courseIds } : { courseIds, creditSelections: selections },
    creditErrors: errors,
  };
}
