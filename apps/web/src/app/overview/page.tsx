/**
 * @file Student overview: record, audit freshness, and the requirement tree, as the API returns.
 * @module @caa/web/app/overview/page
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { type AcademicSummaryResponse, ApiError } from '@caa/api-contract';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { AuditFreshness } from '@/features/academic-summary/components/audit-freshness';
import { RecordDetails } from '@/features/academic-summary/components/record-details';
import { RequirementOverview } from '@/features/academic-summary/components/requirement-overview';
import { ApiErrorNotice } from '@/features/service-errors/components/api-error-notice';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';

/** Render on every request: the summary is the student's current pinned data. */
export const dynamic = 'force-dynamic';

/**
 * Loads the summary, keeping an API error envelope to show.
 *
 * @param studentId - Internal student ID from the query.
 * @returns The summary, or the API error.
 * @throws {Error} When the failure isn't an API error envelope; the error boundary shows it.
 */
async function loadSummary(studentId: string): Promise<AcademicSummaryResponse | ApiError> {
  try {
    return await getAcademicSummary(studentId);
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
}

/**
 * Renders the overview, the API's error notice, or the lookup form when no student is named.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function OverviewPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const { studentId } = await searchParams;
  if (typeof studentId !== 'string' || studentId.trim() === '') {
    return (
      <>
        <h1>Overview</h1>
        <StudentLookupForm isMissingId={studentId !== undefined} />
      </>
    );
  }
  const summary = await loadSummary(studentId.trim());
  return (
    <>
      <StudentNav studentId={studentId.trim()} current="overview" />
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
    </>
  );
}
