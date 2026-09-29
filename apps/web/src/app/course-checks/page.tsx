/**
 * @file Course check page: pick candidate courses and see each check dimension separately, as
 * the API returns them.
 * @module @caa/web/app/course-checks/page
 * @requirement FR-05
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { checkCourses } from '@/api/course-checks.api';
import { CourseCheckScreen } from '@/features/course-checks/components/course-check-screen';
import { planCheckRequest } from '@/features/course-checks/utils/check-request-plan';
import {
  readCourseCheckQuery,
  type SearchParams,
} from '@/features/course-checks/utils/course-check-query';
import { planCourseCheckView } from '@/features/course-checks/utils/course-check-view';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { keepApiError } from '@/shared/utils/keep-api-error';

/** Page title. */
export const metadata: Metadata = { title: 'Course checks' };

/** Render on every request: results are for the student's current pinned data. */
export const dynamic = 'force-dynamic';

/**
 * Renders the picker and, when a valid selection was submitted, its check results.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function CourseChecksPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactElement> {
  const query = readCourseCheckQuery(await searchParams);
  const { student } = query;
  if (student.kind !== 'valid') {
    return (
      <>
        <h1>Course checks</h1>
        <StudentLookupForm idError={student.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  // The summary comes first: its catalog entries give the credit range each typed value must fit.
  const summary = await keepApiError(getAcademicSummary(student.studentId));
  const plan = planCheckRequest(query, summary);
  const result =
    plan.request === null
      ? null
      : await keepApiError(checkCourses(student.studentId, plan.request));
  return (
    <>
      <StudentNav studentId={student.studentId} current="course-checks" />
      <h1>Course checks</h1>
      <p>Check a possible set of courses. Nothing here registers you or changes your record.</p>
      <CourseCheckScreen
        studentId={student.studentId}
        view={planCourseCheckView({ query, summary, plan, result })}
        selectedCourseIds={query.selectedCourseIds}
      />
    </>
  );
}
