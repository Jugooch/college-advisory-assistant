/**
 * @file Case review page: one case with the student's note, the plan frozen into it, its history,
 * and the actions the API allows this reviewer. Shown as the API returns it.
 * @module @caa/web/app/advisor/cases/[caseId]/page
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

import { getCase } from '@/api/cases.api';
import { reviewCaseAction } from '@/features/advisor-cases/actions/review-case.action';
import { AdvisorNav } from '@/features/advisor-cases/components/advisor-nav';
import { AdvisorNotice } from '@/features/advisor-cases/components/advisor-notice';
import { CaseDetails } from '@/features/advisor-cases/components/case-details';
import { CaseReviewPanel } from '@/features/advisor-cases/components/case-review-panel';
import { readCaseIdParam } from '@/features/advisor-cases/utils/case-id-param';
import {
  describeReviewReason,
  NO_ACCESS_EXPLANATION,
  NO_ACCESS_HEADING,
  NO_ACCESS_NEXT_STEP,
} from '@/features/advisor-cases/utils/review-wording';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { keepApiError } from '@/shared/utils/keep-api-error';

/** Page title. */
export const metadata: Metadata = { title: 'Review a case' };

/** Render on every request: a case's status and its plan's freshness change over time. */
export const dynamic = 'force-dynamic';

/**
 * Renders the case, or a notice when it isn't available.
 *
 * @param props - The route params.
 * @returns The page element.
 */
export default async function ReviewCasePage({
  params,
}: {
  readonly params: Promise<{ readonly caseId: string }>;
}): Promise<ReactElement> {
  const caseId = readCaseIdParam((await params).caseId);
  const view = caseId === null ? null : await keepApiError(getCase(caseId));
  if (view === null || (view instanceof ApiError && view.code === ErrorCode.NotFound)) {
    return (
      <>
        <AdvisorNav isQueueCurrent={false} />
        <AdvisorNotice
          heading={NO_ACCESS_HEADING}
          explanation={NO_ACCESS_EXPLANATION}
          nextStep={NO_ACCESS_NEXT_STEP}
          href="/advisor/queue"
          linkLabel="Back to the review queue"
        />
      </>
    );
  }
  if (view instanceof ApiError) {
    return <ApiErrorNotice error={view} />;
  }
  return (
    <>
      <AdvisorNav isQueueCurrent={false} />
      <CaseReviewPanel
        title={describeReviewReason(view.reason)}
        caseId={view.id}
        lastSequence={view.lastSequence}
        allowedActions={view.allowedActions}
        reviewAction={reviewCaseAction}
      >
        <CaseDetails view={view} />
      </CaseReviewPanel>
    </>
  );
}
