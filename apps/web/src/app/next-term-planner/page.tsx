/**
 * @file Next-term planner page: state the term, courses, and constraints, review them, and
 * confirm before any search.
 * @module @caa/web/app/next-term-planner/page
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { getPlannableTerms } from '@/api/plannable-terms.api';
import { findScheduleOptions } from '@/api/schedule-options.api';
import { PlannerScreen } from '@/features/next-term-planner/components/planner-screen';
import { planScheduleRequest } from '@/features/next-term-planner/utils/planner-plan';
import {
  readPlannerQuery,
  type SearchParams,
} from '@/features/next-term-planner/utils/planner-query';
import {
  isSearchRequested,
  planPlannerView,
} from '@/features/next-term-planner/utils/planner-view';
import { ScheduleResults } from '@/features/schedule-options/components/schedule-results';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { planCandidateCourses } from '@/shared/utils/candidate-courses';
import { summaryCourses } from '@/shared/utils/course-display';
import { keepApiError } from '@/shared/utils/keep-api-error';

/** Page title. */
export const metadata: Metadata = { title: 'Plan next term' };

/** Render on every request: results are for the student's current pinned data. */
export const dynamic = 'force-dynamic';

/**
 * Renders the planner step the query asks for.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function NextTermPlannerPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactElement> {
  const { student, step, values } = readPlannerQuery(await searchParams);
  if (student.kind !== 'valid') {
    return (
      <>
        <h1>Plan next term</h1>
        <StudentLookupForm idError={student.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  // The summary comes first: its catalog entries give each variable-credit course's range.
  const summary = await keepApiError(getAcademicSummary(student.studentId));
  const terms = await keepApiError(getPlannableTerms(student.studentId));
  const isSummaryFailed = summary instanceof ApiError;
  const courses = summaryCourses(summary);
  const plan = planScheduleRequest(values, courses);
  const outcome =
    isSearchRequested(step, plan) && plan.request !== null
      ? await keepApiError(findScheduleOptions(student.studentId, plan.request))
      : null;
  const view = planPlannerView(step, plan, outcome);
  return (
    <>
      <StudentNav studentId={student.studentId} current="next-term-planner" />
      <h1>Plan next term</h1>
      <p>Set up a search for next term. Nothing here registers you or changes your record.</p>
      {isSummaryFailed ? (
        <ApiErrorNotice error={summary} headingId="summary-error-heading" />
      ) : null}
      {terms instanceof ApiError ? (
        <ApiErrorNotice error={terms} headingId="terms-error-heading" />
      ) : null}
      {view.kind === 'searched' ? <ScheduleResults result={view.result} courses={courses} /> : null}
      <PlannerScreen
        studentId={student.studentId}
        view={view}
        values={values}
        candidates={planCandidateCourses(summary, values.courseIds)}
        isCandidateListUnavailable={isSummaryFailed}
        courses={courses}
        terms={terms instanceof ApiError ? null : terms.terms}
        credits={{ inputs: values.creditInputs, errors: plan.creditErrors }}
      />
    </>
  );
}
