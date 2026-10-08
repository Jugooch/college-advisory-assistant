/**
 * @file Review queue page: the cases an advisor or admin can review, oldest first, with a status
 * filter and, for admins, an "Unrouted" filter. Rows are shown as the API returns them.
 * @module @caa/web/app/advisor/queue/page
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';

import { listAdvisorCases } from '@/api/cases.api';
import { getMe } from '@/api/session.api';
import { AdvisorNav } from '@/features/advisor-cases/components/advisor-nav';
import { AdvisorNotice } from '@/features/advisor-cases/components/advisor-notice';
import { CaseQueue } from '@/features/advisor-cases/components/case-queue';
import { CaseQueueFilter } from '@/features/advisor-cases/components/case-queue-filter';
import {
  QUEUE_FILTER_FIELD,
  readQueueFilter,
  toQueueQuery,
} from '@/features/advisor-cases/utils/queue-filter';
import {
  NOT_AN_ADVISOR_EXPLANATION,
  NOT_AN_ADVISOR_HEADING,
  NOT_AN_ADVISOR_NEXT_STEP,
} from '@/features/advisor-cases/utils/review-wording';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { keepApiError } from '@/shared/utils/keep-api-error';
import { canReviewCases, isAdminSession } from '@/shared/utils/session-roles';

/** Page title. */
export const metadata: Metadata = { title: 'Review queue' };

/** Render on every request: the queue changes as cases are claimed and resolved. */
export const dynamic = 'force-dynamic';

/**
 * Renders the queue, the API's error notice, or a notice for a session that isn't an advisor's.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function ReviewQueuePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const me = await keepApiError(getMe());
  if (me instanceof ApiError) {
    return <ApiErrorNotice error={me} />;
  }
  if (!canReviewCases(me.roles)) {
    return (
      <AdvisorNotice
        heading={NOT_AN_ADVISOR_HEADING}
        explanation={NOT_AN_ADVISOR_EXPLANATION}
        nextStep={NOT_AN_ADVISOR_NEXT_STEP}
        href="/"
        linkLabel="Go to the home page"
      />
    );
  }
  const isAdmin = isAdminSession(me.roles);
  const filter = readQueueFilter((await searchParams)[QUEUE_FILTER_FIELD], isAdmin);
  const queue = await keepApiError(listAdvisorCases(toQueueQuery(filter)));
  return (
    <>
      <AdvisorNav isQueueCurrent />
      <h1>Review queue</h1>
      <p>
        Cases students have sent to their advising team, oldest first. Claim a case to review it.
        Students are not notified by email or message, so their answer is the note you leave when
        you resolve it.
      </p>
      <CaseQueueFilter filter={filter} isAdmin={isAdmin} />
      {queue instanceof ApiError ? (
        <ApiErrorNotice error={queue} />
      ) : (
        <CaseQueue queue={queue} filter={filter} now={new Date()} />
      )}
    </>
  );
}
