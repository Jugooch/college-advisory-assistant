/**
 * @file Course check page: pick candidate courses and see each check dimension separately, as
 * the API returns them.
 * @module @caa/web/app/course-checks/page
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { ApiError, CourseChecksRequestSchema } from '@caa/api-contract';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { checkCourses } from '@/api/course-checks.api';
import { CourseCheckResults } from '@/features/course-checks/components/course-check-results';
import { CoursePicker } from '@/features/course-checks/components/course-picker';
import { listCandidateCourses } from '@/features/course-checks/utils/candidate-courses';
import { ApiErrorNotice } from '@/features/service-errors/components/api-error-notice';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';

/** Render on every request: results are for the student's current pinned data. */
export const dynamic = 'force-dynamic';

/** Search params as Next passes them. */
type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Runs an API call, keeping an error envelope to show.
 *
 * @param call - The API call.
 * @returns Its result, or the API error.
 * @throws {Error} When the failure isn't an API error envelope; the error boundary shows it.
 */
async function keepApiError<T>(call: () => Promise<T>): Promise<T | ApiError> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
}

/** What the query asks for. */
interface CheckQuery {
  readonly studentId: string;
  /** Selected course IDs, once each, in submitted order. */
  readonly courseIds: readonly string[];
  readonly request: ReturnType<typeof CourseChecksRequestSchema.safeParse>;
  /** Whether the picker form was submitted, even with nothing selected. */
  readonly isSubmitted: boolean;
}

/**
 * Reads the student and the selected courses from the query.
 *
 * @param query - The page's search params.
 * @returns The student ID (empty when missing), the courses, and the parsed request.
 */
function readQuery(query: SearchParams): CheckQuery {
  const studentId = typeof query.studentId === 'string' ? query.studentId.trim() : '';
  const courseIds = [...new Set(query.course === undefined ? [] : [query.course].flat())];
  return {
    studentId,
    courseIds,
    request: CourseChecksRequestSchema.safeParse({ courseIds }),
    isSubmitted: query.submitted !== undefined || courseIds.length > 0,
  };
}

/**
 * Renders the picker and, when courses were submitted, their check results.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function CourseChecksPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactElement> {
  const { studentId, courseIds, request, isSubmitted } = readQuery(await searchParams);
  if (studentId === '') {
    return (
      <>
        <h1>Course checks</h1>
        <StudentLookupForm isMissingId={false} />
      </>
    );
  }
  const [summary, result] = await Promise.all([
    keepApiError(() => getAcademicSummary(studentId)),
    request.success ? keepApiError(() => checkCourses(studentId, request.data)) : null,
  ]);
  return (
    <>
      <StudentNav studentId={studentId} current="course-checks" />
      <h1>Course checks</h1>
      <p>Check a possible set of courses. Nothing here registers you or changes your record.</p>
      {result instanceof ApiError ? <ApiErrorNotice error={result} /> : null}
      {result === null || result instanceof ApiError ? null : (
        <CourseCheckResults result={result} />
      )}
      {summary instanceof ApiError ? (
        result === null ? (
          <ApiErrorNotice error={summary} />
        ) : null
      ) : (
        <CoursePicker
          studentId={studentId}
          candidates={listCandidateCourses(summary.requirements)}
          selectedCourseIds={courseIds}
          hasSelectionError={isSubmitted && !request.success}
        />
      )}
    </>
  );
}
