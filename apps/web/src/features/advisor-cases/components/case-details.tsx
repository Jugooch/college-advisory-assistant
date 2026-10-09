/**
 * @file Everything a reviewer reads on one case: why it was opened, the student's note, who holds
 * it, the frozen plan, and the history. It decides nothing: actions live in the review panel and
 * come only from the API's `allowedActions`.
 * @module @caa/web/features/advisor-cases/components/case-details
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { CaseView } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeSubject } from '@/shared/utils/case-wording';

import {
  describeCaseStanding,
  describeQueueStatus,
  DISCREPANCY_CHANGES_NOTHING,
  NO_PLAN_ON_REPORT,
} from '../utils/review-wording';
import { ReviewPlan } from './review-plan';
import { ReviewTimeline } from './review-timeline';

/** Props for {@link CaseDetails}. */
export interface CaseDetailsProps {
  readonly view: CaseView;
}

/**
 * Renders the case's facts, plan, and history.
 *
 * @param props - The case view as the API returned it.
 * @returns The sections.
 */
export function CaseDetails({ view }: CaseDetailsProps): ReactElement {
  return (
    <>
      <section aria-labelledby="case-request-heading">
        <h2 id="case-request-heading">What the student asked</h2>
        <p>
          <StatusBadge label={describeQueueStatus(view.status)} tone="neutral" />
        </p>
        <p>{describeCaseStanding(view.status, view.owner)}</p>
        <dl className="facts">
          <dt>Opened</dt>
          <dd>
            <Timestamp iso={view.createdAt} />
          </dd>
          {view.discrepancySubject === null ? null : (
            <>
              <dt>Disputed record</dt>
              <dd>{describeSubject(view.discrepancySubject)}</dd>
            </>
          )}
          <dt>Student’s note</dt>
          <dd className="note-text">{view.studentNote}</dd>
        </dl>
        {view.discrepancySubject === null ? null : <p>{DISCREPANCY_CHANGES_NOTHING}</p>}
      </section>
      {view.context === null ? <p>{NO_PLAN_ON_REPORT}</p> : <ReviewPlan revision={view.context} />}
      <section aria-labelledby="case-history-heading">
        <h2 id="case-history-heading">History</h2>
        <ReviewTimeline events={view.events} />
      </section>
    </>
  );
}
