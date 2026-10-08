/**
 * @file My plans page: the student's saved drafts, one per term, with freshness and open case.
 * @module @caa/web/app/my-plans/page
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { listPlans } from '@/api/plan-drafts.api';
import { getPlannableTerms } from '@/api/plannable-terms.api';
import { PlanList } from '@/features/plan-drafts/components/plan-list';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'My plans' };

/** Render on every request: freshness is derived when the list is read. */
export const dynamic = 'force-dynamic';

/**
 * Renders the plan list, the API's error notice, or the lookup form when no valid student is named.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function MyPlansPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const query = readStudentIdQuery((await searchParams).studentId);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>My plans</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  const plans = await keepApiError(listPlans(query.studentId));
  const terms = await keepApiError(getPlannableTerms(query.studentId));
  return (
    <>
      <StudentNav studentId={query.studentId} current="my-plans" />
      <h1>My plans</h1>
      <p>A draft is a saved plan. It isn’t a registration, and it doesn’t change your record.</p>
      {plans instanceof ApiError ? (
        <ApiErrorNotice error={plans} />
      ) : (
        <PlanList
          plans={plans.plans}
          terms={terms instanceof ApiError ? null : terms.terms}
          plannerHref={`/next-term-planner?studentId=${query.studentId}`}
        />
      )}
    </>
  );
}
