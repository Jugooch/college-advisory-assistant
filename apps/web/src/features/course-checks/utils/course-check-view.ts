/**
 * @file Decides what the course check page shows from the query and the two API outcomes.
 * Display choices only: every state shown is the API's.
 * @module @caa/web/features/course-checks/utils/course-check-view
 * @requirement FR-09
 * @requirement NFR-02
 */
import {
  type AcademicSummaryResponse,
  ApiError,
  type CourseChecksResponse,
} from '@caa/api-contract';

import { type CandidateCourse, planCandidateCourses } from '@/shared/utils/candidate-courses';
import { type CourseLookup, indexCourses } from '@/shared/utils/course-display';
import type { CreditChoices } from '@/shared/utils/credit-choice';

import type { CheckRequestPlan } from './check-request-plan';
import { type CourseCheckQuery, describeSelectionError } from './course-check-query';

/** The picker's error when only a credit value stopped the check. */
export const CREDIT_ERROR_SUMMARY = 'Fix the credit value marked below, then check again.';

/** Everything the course check screen renders. */
export interface CourseCheckView {
  /** The check results, or null when no check ran or it failed. */
  readonly result: CourseChecksResponse | null;
  /** The check's error envelope, or null. */
  readonly resultError: ApiError | null;
  /** The summary's error envelope, or null. Shown even when results are shown. */
  readonly summaryError: ApiError | null;
  /** Courses the picker offers. */
  readonly candidates: readonly CandidateCourse[];
  /** Whether the audit's candidates couldn't be listed because the summary failed. */
  readonly isCandidateListUnavailable: boolean;
  /** The picker's selection error, or null. */
  readonly selectionError: string | null;
  /** Catalog display entries of every course either response names, by course ID. */
  readonly courses: CourseLookup;
  /** The typed credit values and their errors. */
  readonly credits: CreditChoices;
}

/** The inputs the view is planned from. */
export interface CourseCheckViewInput {
  readonly query: CourseCheckQuery;
  readonly summary: AcademicSummaryResponse | ApiError;
  /** The planned request, with any credit errors. */
  readonly plan: CheckRequestPlan;
  /** The check's outcome, or null when no request was sent. */
  readonly result: CourseChecksResponse | ApiError | null;
}

/**
 * Plans the screen. A failed summary never hides results, and the picker always stays: without
 * the summary it offers the courses just checked, so the student can check them again.
 *
 * @param input - The query, the planned request, and the API outcomes.
 * @returns What to render.
 */
export function planCourseCheckView({
  query,
  summary,
  plan,
  result,
}: CourseCheckViewInput): CourseCheckView {
  const isSummaryFailed = summary instanceof ApiError;
  const checked = result instanceof ApiError ? null : result;
  const checkedCourseIds =
    query.selection.kind === 'valid' ? query.selection.request.courseIds : [];
  const creditError = plan.creditErrors.size > 0 ? CREDIT_ERROR_SUMMARY : null;
  return {
    result: checked,
    resultError: result instanceof ApiError ? result : null,
    summaryError: isSummaryFailed ? summary : null,
    candidates: planCandidateCourses(summary, checkedCourseIds),
    isCandidateListUnavailable: isSummaryFailed,
    selectionError: describeSelectionError(query.selection) ?? creditError,
    courses: indexCourses(checked?.courses, isSummaryFailed ? undefined : summary.courses),
    credits: { inputs: query.creditInputs, errors: plan.creditErrors },
  };
}
