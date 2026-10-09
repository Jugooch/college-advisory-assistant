/**
 * @file Student overview: record, audit freshness, and the requirement tree, as the API returns.
 * @module @caa/web/app/overview/page
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { listStudentCases } from '@/api/cases.api';
import { OpenCaseSummary } from '@/features/advisor-cases/components/open-case-summary';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { AuditFreshness } from '@/shared/components/audit-freshness';
import { RecordDetails } from '@/shared/components/record-details';
import { RequirementOverview } from '@/shared/components/requirement-overview';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Overview' };

/** Render on every request: the summary is the student's current pinned data. */
export const dynamic = 'force-dynamic';

/**
 * Renders the overview, the API's error notice, or the lookup form when no valid student is named.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function OverviewPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const query = readStudentIdQuery((await searchParams).studentId);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Overview</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const summary = await keepApiError(getAcademicSummary(query.studentId));
  const cases = await keepApiError(listStudentCases(query.studentId));
  return (
    <>
      <StudentNav studentId={query.studentId} current="overview" />
      <h1>Overview</h1>
      {summary instanceof ApiError ? (
        <ApiErrorNotice error={summary} />
      ) : (
        <>
          <p>Read-only. Nothing here changes your official record or registers you for a course.</p>
          <RecordDetails summary={summary} />
          <AuditFreshness summary={summary} />
          <RequirementOverview summary={summary} />
        </>
      )}
      {cases instanceof ApiError ? (
        <ApiErrorNotice error={cases} headingId="cases-error-heading" />
      ) : (
        <OpenCaseSummary
          cases={cases.cases}
          casesHref={`/help-and-cases?studentId=${query.studentId}`}
          reportHref={`/report-a-problem?studentId=${query.studentId}`}
        />
      )}
    </>
  );
}
