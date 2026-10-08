/**
 * @file Ask an advisor page: shows one saved plan revision and a form to send it for review.
 * @module @caa/web/app/ask-an-advisor/page
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { getPlan } from '@/api/plan-drafts.api';
import { createCaseAction } from '@/features/advisor-cases/actions/create-case.action';
import { AskAdvisorForm } from '@/features/advisor-cases/components/ask-advisor-form';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { PlanFreshness } from '@/shared/components/plan-freshness';
import { Timestamp } from '@/shared/components/timestamp';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readPlanIdQuery } from '@/shared/utils/plan-id-query';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Ask an advisor' };

/** Render on every request: the plan's freshness is derived when it is read. */
export const dynamic = 'force-dynamic';

/**
 * Renders the form for the named plan, the API's error notice, or the lookup form when no valid
 * student is named.
 *
 * @param props - The page's search params: `studentId` and `planId`.
 * @returns The page element.
 */
export default async function AskAnAdvisorPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const query = readStudentIdQuery(params.studentId);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Ask an advisor</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const planId = readPlanIdQuery(params.planId);
  const casesHref = `/help-and-cases?studentId=${query.studentId}`;
  const plansHref = `/my-plans?studentId=${query.studentId}`;
  if (planId === null) {
    return (
      <>
        <StudentNav studentId={query.studentId} current={null} />
        <h1>Ask an advisor</h1>
        <p>
          Choose a draft first. Open <Link href={plansHref}>My plans</Link> and pick the draft you
          want to ask about.
        </p>
      </>
    );
  }
  const plan = await keepApiError(getPlan(query.studentId, planId));
  return (
    <>
      <StudentNav studentId={query.studentId} current={null} />
      <h1>Ask an advisor</h1>
      {plan instanceof ApiError ? (
        <ApiErrorNotice error={plan} />
      ) : (
        <>
          <p>
            An advisor can review this saved plan with you. Asking doesn’t register you for
            anything, and the advisor’s answer is advice, not permission to enroll.
          </p>
          <h2>Plan revision {plan.latest.revision}</h2>
          <p>
            As saved on <Timestamp iso={plan.latest.createdAt} />.
          </p>
          <PlanFreshness freshness={plan.latest.freshness} />
          <AskAdvisorForm
            createAction={createCaseAction}
            studentId={query.studentId}
            revision={plan.latest}
            casesHref={casesHref}
          />
        </>
      )}
    </>
  );
}
