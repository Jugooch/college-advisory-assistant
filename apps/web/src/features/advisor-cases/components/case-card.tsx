/**
 * @file One case as the student sees it: its status in words with what it means and what to do
 * next, the student's own note, the frozen plan, the advisor's resolution, its history, and a
 * withdraw control when the API allows it. Nothing here says a waiver, approval, or registration.
 * @module @caa/web/features/advisor-cases/components/case-card
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { CaseEventView, CaseView } from '@caa/api-contract';
import { CaseAction, CaseStatus } from '@caa/domain';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import {
  describeCaseReason,
  describeCaseStatus,
  describeSubject,
  REPORT_CHANGES_NOTHING,
} from '@/shared/utils/case-wording';

import type { WithdrawCaseState } from '../utils/withdraw-case-state';
import { CaseResolution } from './case-resolution';
import { CaseTimeline } from './case-timeline';
import { FrozenPlan } from './frozen-plan';
import { WithdrawCaseForm } from './withdraw-case-form';

/** Props for {@link CaseCard}. */
export interface CaseCardProps {
  readonly view: CaseView;
  /** Server action that withdraws the case. */
  readonly withdrawAction: (
    previous: WithdrawCaseState,
    formData: FormData,
  ) => Promise<WithdrawCaseState>;
}

/**
 * Finds the event that resolved the case.
 *
 * @param events - The case's events.
 * @returns The `RESOLVE` event, or `undefined` when there is none.
 */
function findResolveEvent(events: readonly CaseEventView[]): CaseEventView | undefined {
  return events.find((event) => event.action === CaseAction.Resolve);
}

/**
 * Renders one case.
 *
 * @param props - The case view and the withdraw action.
 * @returns The case article.
 */
export function CaseCard({ view, withdrawAction }: CaseCardProps): ReactElement {
  const status = describeCaseStatus(view.status);
  const resolveEvent = findResolveEvent(view.events);
  const headingId = `case-${view.id}-heading`;
  return (
    <article aria-labelledby={headingId}>
      <h3 id={headingId}>
        {describeCaseReason(view.reason)}
        {view.discrepancySubject === null ? null : `: ${describeSubject(view.discrepancySubject)}`}
      </h3>
      <p>
        <StatusBadge label={status.label} tone={status.tone} />
      </p>
      <p>{status.explanation}</p>
      <p>{status.nextStep}</p>
      <dl className="facts">
        <dt>Opened</dt>
        <dd>
          <Timestamp iso={view.createdAt} />
        </dd>
        <dt>Your note</dt>
        <dd className="note-text">{view.studentNote}</dd>
      </dl>
      {view.discrepancySubject === null ? null : <p>{REPORT_CHANGES_NOTHING}</p>}
      {view.context === null ? null : <FrozenPlan revision={view.context} />}
      {view.status === CaseStatus.Resolved && resolveEvent !== undefined ? (
        <CaseResolution event={resolveEvent} />
      ) : null}
      <h4>History</h4>
      <CaseTimeline events={view.events} />
      {view.allowedActions.includes(CaseAction.Withdraw) ? (
        <WithdrawCaseForm
          withdrawAction={withdrawAction}
          caseId={view.id}
          lastSequence={view.lastSequence}
        />
      ) : null}
    </article>
  );
}
