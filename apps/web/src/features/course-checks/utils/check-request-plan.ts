/**
 * @file Builds the course-checks request from the query: the selected courses and the credit
 * values typed for variable-credit courses, each within the catalog range.
 * @module @caa/web/features/course-checks/utils/check-request-plan
 * @requirement FR-05
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicSummaryResponse,
  ApiError,
  type CourseChecksRequest,
} from '@caa/api-contract';
import { CreditRuleKind } from '@caa/domain';

import { type CourseLookup, indexCourses } from '@/shared/utils/course-display';

import type { CourseCheckQuery } from './course-check-query';
import { readCreditChoice } from './credit-choice';

/** What the page sends, or why it sends nothing. */
export interface CheckRequestPlan {
  /** The request, or null when no valid selection was submitted or a credit value was rejected. */
  readonly request: CourseChecksRequest | null;
  /** Why a typed credit value was rejected, by course ID. */
  readonly creditErrors: ReadonlyMap<string, string>;
}

/** The credit selections of a request. */
type CreditSelections = NonNullable<CourseChecksRequest['creditSelections']>;

/**
 * Lists the summary's display entries.
 *
 * @param summary - The summary, or its error envelope.
 * @returns The entries by course ID; empty when the summary failed or sent none.
 */
export function summaryCourses(summary: AcademicSummaryResponse | ApiError): CourseLookup {
  return indexCourses(summary instanceof ApiError ? undefined : summary.courses);
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
  const courses = summaryCourses(summary);
  const { courseIds } = query.selection.request;
  const creditSelections: CreditSelections[number][] = [];
  const creditErrors = new Map<string, string>();
  for (const courseId of courseIds) {
    const rule = courses.get(courseId)?.credits;
    if (rule?.kind !== CreditRuleKind.Variable) {
      continue;
    }
    const choice = readCreditChoice(query.creditInputs.get(courseId), rule);
    if (choice.kind === 'invalid') {
      creditErrors.set(courseId, choice.message);
    } else if (choice.kind === 'chosen') {
      creditSelections.push({ courseId, selectedCreditsHundredths: choice.hundredths });
    }
  }
  if (creditErrors.size > 0) {
    return { request: null, creditErrors };
  }
  return {
    request: creditSelections.length === 0 ? { courseIds } : { courseIds, creditSelections },
    creditErrors,
  };
}
