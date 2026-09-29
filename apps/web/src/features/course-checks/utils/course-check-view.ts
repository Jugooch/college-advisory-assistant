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

import { type CandidateCourse, listCandidateCourses } from './candidate-courses';
import { type CourseCheckQuery, describeSelectionError } from './course-check-query';

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
}

/** The inputs the view is planned from. */
export interface CourseCheckViewInput {
  readonly query: CourseCheckQuery;
  readonly summary: AcademicSummaryResponse | ApiError;
  /** The check's outcome, or null when no valid selection was submitted. */
  readonly result: CourseChecksResponse | ApiError | null;
}

/**
 * Plans the screen. A failed summary never hides results, and the picker always stays: without
 * the summary it offers the courses just checked, so the student can check them again.
 *
 * @param input - The query and the API outcomes.
 * @returns What to render.
 */
export function planCourseCheckView({
  query,
  summary,
  result,
}: CourseCheckViewInput): CourseCheckView {
  const isSummaryFailed = summary instanceof ApiError;
  const checkedCourseIds =
    query.selection.kind === 'valid' ? query.selection.request.courseIds : [];
  return {
    result: result instanceof ApiError ? null : result,
    resultError: result instanceof ApiError ? result : null,
    summaryError: isSummaryFailed ? summary : null,
    candidates: isSummaryFailed
      ? checkedCourseIds.map((courseId) => ({ courseId, requirementLabels: [] }))
      : listCandidateCourses(summary.requirements),
    isCandidateListUnavailable: isSummaryFailed,
    selectionError: describeSelectionError(query.selection),
  };
}
