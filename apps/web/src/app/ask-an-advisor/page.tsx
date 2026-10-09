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

import { ApiError, type PlanRevisionView } from '@caa/api-contract';

import { getPlan, getPlanRevision } from '@/api/plan-drafts.api';
import { createCaseAction } from '@/features/advisor-cases/actions/create-case.action';
import { AskAdvisorForm } from '@/features/advisor-cases/components/ask-advisor-form';
import {
  readHandoffRevision,
  readPlanReasonQuery,
} from '@/features/advisor-cases/utils/handoff-query';
import { readPlanIdQuery } from '@/features/advisor-cases/utils/plan-id-query';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { PlanFreshness } from '@/shared/components/plan-freshness';
import { Timestamp } from '@/shared/components/timestamp';
import { HandoffQuery } from '@/shared/utils/case-handoff-query';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Ask an advisor' };

/** Render on every request: the plan's freshness is derived when it is read. */
export const dynamic = 'force-dynamic';

/**
 * Loads the revision to ask about: the one the chat preview named if it is an earlier one,
 * otherwise the plan's latest.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param planId - The plan's ID.
 * @param revisionParam - The raw `revision` query value.
 * @returns The revision as the API returned it, or the API's error.
 */
async function loadRevision(
  studentId: string,
  planId: string,
  revisionParam: string | string[] | undefined,
): Promise<PlanRevisionView | ApiError> {
  const plan = await keepApiError(getPlan(studentId, planId));
  if (plan instanceof ApiError) {
    return plan;
  }
  const earlier = readHandoffRevision(revisionParam, plan.latest.revision);
  return earlier === null ? plan.latest : keepApiError(getPlanRevision(studentId, planId, earlier));
}

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
  const query = readStudentIdQuery(params[HandoffQuery.StudentId]);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Ask an advisor</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const planId = readPlanIdQuery(params[HandoffQuery.PlanId]);
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
  const shown = await loadRevision(query.studentId, planId, params[HandoffQuery.Revision]);
  return (
    <>
      <StudentNav studentId={query.studentId} current={null} />
      <h1>Ask an advisor</h1>
      {shown instanceof ApiError ? (
        <ApiErrorNotice error={shown} />
      ) : (
        <>
          <p>
            An advisor can review this saved plan with you. Asking doesn’t register you for
            anything, and the advisor’s answer is advice, not permission to enroll.
          </p>
          <h2>Plan revision {shown.revision}</h2>
          <p>
            As saved on <Timestamp iso={shown.createdAt} />.
          </p>
          <PlanFreshness freshness={shown.freshness} />
          <AskAdvisorForm
            createAction={createCaseAction}
            studentId={query.studentId}
            revision={shown}
            initialReason={readPlanReasonQuery(params[HandoffQuery.Reason])}
            casesHref={casesHref}
          />
        </>
      )}
    </>
  );
}
