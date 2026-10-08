/**
 * @file Help and cases page: the student's advisor cases with their status, resolution, and the
 * plan attached to each. Cases are shown as the API returns them.
 * @module @caa/web/app/help-and-cases/page
 * @requirement FR-12
 * @requirement FR-16
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import {
  ApiError,
  type CaseListResponse,
  type CaseView,
  type PolicySearchResponse,
} from '@caa/api-contract';

import { getCase, listStudentCases } from '@/api/cases.api';
import { searchPolicies } from '@/api/policies.api';
import { withdrawCaseAction } from '@/features/advisor-cases/actions/withdraw-case.action';
import { CaseList } from '@/features/advisor-cases/components/case-list';
import { PolicyHelpSection } from '@/features/policy-help/components/policy-help-section';
import type { WhereToAskEntry } from '@/features/policy-help/components/where-to-ask';
import { type PolicyQuery, readPolicyQuery } from '@/features/policy-help/utils/policy-query';
import { WHERE_TO_ASK_TOPICS } from '@/features/policy-help/utils/topic-wording';
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
 * Runs the policy search the URL asks for and the where-to-ask lookups, keeping API errors.
 *
 * @param value - The raw `q` query value.
 * @returns The parsed query, the search outcome, and one outcome per specialist topic.
 */
async function loadPolicyHelp(value: string | readonly string[] | undefined): Promise<{
  readonly search: PolicyQuery;
  readonly searchResult: PolicySearchResponse | ApiError | null;
  readonly whereToAsk: readonly WhereToAskEntry[];
}> {
  const search = readPolicyQuery(value);
  const [searchResult, whereToAsk] = await Promise.all([
    search.kind === 'valid' ? keepApiError(searchPolicies({ q: search.text })) : null,
    Promise.all(
      WHERE_TO_ASK_TOPICS.map(async (topic) => ({
        topic,
        result: await keepApiError(searchPolicies({ topic })),
      })),
    ),
  ]);
  return { search, searchResult, whereToAsk };
}

/**
 * Reads each listed case's full view; a case that can't be read shows without its plan.
 *
 * @param list - The student's case list.
 * @returns One entry per case.
 */
async function loadCaseEntries(
  list: CaseListResponse,
): Promise<
  readonly { readonly summary: CaseListResponse['cases'][number]; readonly view: CaseView | null }[]
> {
  return Promise.all(
    list.cases.map(async (summary) => {
      const view = await keepApiError(getCase(summary.id));
      return { summary, view: view instanceof ApiError ? null : view };
    }),
  );
}

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
  const { studentId, q } = await searchParams;
  const query = readStudentIdQuery(studentId);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Help and cases</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const { search, searchResult, whereToAsk } = await loadPolicyHelp(q);
  const list = await keepApiError(listStudentCases(query.studentId));
  const entries = list instanceof ApiError ? [] : await loadCaseEntries(list);
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
      <PolicyHelpSection
        studentId={query.studentId}
        search={search}
        searchResult={searchResult}
        whereToAsk={whereToAsk}
      />
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
