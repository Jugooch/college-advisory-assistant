/**
 * @file Plan detail page: one plan's revision with its freshness, history, and Revalidate. A
 * stale or unknown revision is shown in full as history, never as current.
 * @module @caa/web/app/my-plans/[planId]/page
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-05
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { ApiError, type ScheduleOptionsResponse } from '@caa/api-contract';
import type { PlanId, StudentId } from '@caa/domain';

import { getPlan, getPlanRevision } from '@/api/plan-drafts.api';
import { getPlannableTerms } from '@/api/plannable-terms.api';
import { revalidatePlanAction } from '@/features/plan-drafts/actions/revalidate-plan.action';
import { PlanDetail } from '@/features/plan-drafts/components/plan-detail';
import { readPlanIdParam } from '@/features/plan-drafts/utils/plan-id-param';
import { readRevisionQuery } from '@/features/plan-drafts/utils/revision-query';
import { ScheduleResults } from '@/features/schedule-options/components/schedule-results';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Plan detail' };

/** Render on every request: freshness is derived when the plan is read. */
export const dynamic = 'force-dynamic';

/**
 * Renders the plan, the API's error notice, or the lookup form when no valid student is named.
 *
 * @param props - The route params and the page's search params.
 * @returns The page element.
 */
export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly planId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const planId = readPlanIdParam((await params).planId);
  if (planId === null) {
    notFound();
  }
  const query = await searchParams;
  const student = readStudentIdQuery(query.studentId);
  if (student.kind !== 'valid') {
    return (
      <>
        <h1>Plan detail</h1>
        <StudentLookupForm idError={student.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  return (
    <>
      <StudentNav studentId={student.studentId} current="my-plans" />
      <PlanDetailBody studentId={student.studentId} planId={planId} revision={query.revision} />
    </>
  );
}

/**
 * Loads the plan and the revision asked for, and renders it or the API's error notice.
 *
 * @param props - The student, the plan, and the raw `revision` query value.
 * @returns The plan detail, or an error notice with a way back.
 */
async function PlanDetailBody({
  studentId,
  planId,
  revision,
}: {
  readonly studentId: StudentId;
  readonly planId: PlanId;
  readonly revision: string | string[] | undefined;
}): Promise<ReactElement> {
  const plansHref = `/my-plans?studentId=${studentId}`;
  const plan = await keepApiError(getPlan(studentId, planId));
  if (plan instanceof ApiError) {
    return (
      <>
        <h1>Plan detail</h1>
        <ApiErrorNotice error={plan} />
        <p>
          <Link href={plansHref}>Back to My plans</Link>
        </p>
      </>
    );
  }
  const requested = readRevisionQuery(revision, plan.latest.revision);
  const shown =
    requested === null
      ? plan.latest
      : await keepApiError(getPlanRevision(studentId, planId, requested));
  if (shown instanceof ApiError) {
    return (
      <>
        <h1>Plan detail</h1>
        <ApiErrorNotice error={shown} />
        <p>
          <Link href={`/my-plans/${plan.id}?studentId=${studentId}`}>
            Go to the latest revision
          </Link>
        </p>
      </>
    );
  }
  const terms = await keepApiError(getPlannableTerms(studentId));
  const termCode =
    terms instanceof ApiError
      ? null
      : (terms.terms.find((term) => term.id === plan.termId)?.termCode ?? null);
  return (
    <PlanDetail
      revalidateAction={revalidatePlanAction}
      studentId={studentId}
      plan={plan}
      shown={shown}
      termCode={termCode}
      plannerHref={`/next-term-planner?studentId=${studentId}`}
      plansHref={plansHref}
      renderResult={renderSavedResult}
    />
  );
}

/**
 * Renders a saved result under its "as of" heading. Focus stays where it is: a saved result
 * isn't a finished search.
 *
 * @param result - The saved result.
 * @param heading - The heading text.
 * @returns The results section.
 */
function renderSavedResult(result: ScheduleOptionsResponse, heading: string): ReactElement {
  return (
    <ScheduleResults
      result={result}
      courses={new Map()}
      heading={heading}
      isHeadingFocused={false}
    />
  );
}
