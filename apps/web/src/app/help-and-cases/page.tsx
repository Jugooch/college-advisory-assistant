/**
 * @file Help and cases page: the student's advisor cases with their status, resolution, and the
 * plan attached to each. Cases are shown as the API returns them.
 * @module @caa/web/app/help-and-cases/page
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getCase, listStudentCases } from '@/api/cases.api';
import { withdrawCaseAction } from '@/features/advisor-cases/actions/withdraw-case.action';
import { CaseList } from '@/features/advisor-cases/components/case-list';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Help and cases' };

/** Render on every request: a case's status and its plan's freshness change over time. */
export const dynamic = 'force-dynamic';

/**
 * Renders the case list, the API's error notice, or the lookup form when no valid student is named.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function HelpAndCasesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const query = readStudentIdQuery((await searchParams).studentId);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Help and cases</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const list = await keepApiError(listStudentCases(query.studentId));
  const entries =
    list instanceof ApiError
      ? []
      : await Promise.all(
          list.cases.map(async (summary) => {
            const view = await keepApiError(getCase(summary.id));
            return { summary, view: view instanceof ApiError ? null : view };
          }),
        );
  return (
    <>
      <StudentNav studentId={query.studentId} current="help-and-cases" />
      <h1>Help and cases</h1>
      <p>
        A case asks your assigned advising team to look at something. It stays inside this app: no
        email or message is sent, so check this page for updates. An advisor’s answer is advice, not
        permission to enroll.
      </p>
      <p>
        <Link href={`/report-a-problem?studentId=${query.studentId}`}>
          Report a problem with my record
        </Link>
      </p>
      {list instanceof ApiError ? (
        <ApiErrorNotice error={list} />
      ) : (
        <>
          <h2>Your cases</h2>
          <CaseList
            entries={entries}
            withdrawAction={withdrawCaseAction}
            plansHref={`/my-plans?studentId=${query.studentId}`}
          />
        </>
      )}
    </>
  );
}
