/**
 * @file The plan detail screen: header, freshness banner, the plan-vs-registration boundary, the
 * Revalidate action, the revision history, and the saved result as history "as of" its time.
 * Everything is shown as the API returned it; nothing is recomputed or upgraded.
 * @module @caa/web/features/plan-drafts/components/plan-detail
 * @requirement FR-11
 * @requirement NFR-02
 * @requirement NFR-04
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

import type { PlanRevisionView, PlanView, ScheduleOptionsResponse } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

import {
  EARLIER_REVISION_LABEL,
  EARLIER_REVISION_NOTE,
  PLAN_BOUNDARY_NOTE,
} from '../utils/plan-detail-wording';
import type { RevalidateState } from '../utils/revalidate-state';
import { FreshnessBanner } from './freshness-banner';
import { ResultSection } from './result-section';
import { RevalidateForm } from './revalidate-form';
import { RevisionHistory } from './revision-history';

/** Props for {@link PlanDetail}. */
export interface PlanDetailProps {
  /** Server action that revalidates; the page passes it in (standard 06). */
  readonly revalidateAction: (
    previous: RevalidateState,
    formData: FormData,
  ) => Promise<RevalidateState>;
  readonly studentId: string;
  readonly plan: PlanView;
  /** The revision on screen: the plan's latest, or an earlier one opened from the history. */
  readonly shown: PlanRevisionView;
  /** The term's code, or `null` when the planner's terms are unavailable. */
  readonly termCode: string | null;
  /** Link to the planner, for choosing an option again. */
  readonly plannerHref: string;
  /** Link to My plans. */
  readonly plansHref: string;
  /**
   * Renders a saved result under the given heading, without moving focus. The page supplies it,
   * so this feature knows nothing about the schedule results feature.
   */
  readonly renderResult: (result: ScheduleOptionsResponse, heading: string) => ReactNode;
}

/**
 * Renders one revision of a plan. The latest revision gets Revalidate; an earlier one is
 * labeled and read-only.
 *
 * @param props - The plan, the revision on screen, and the links, action, and result renderer the
 *   page supplies.
 * @returns The plan detail.
 */
export function PlanDetail({
  revalidateAction,
  studentId,
  plan,
  shown,
  termCode,
  plannerHref,
  plansHref,
  renderResult,
}: PlanDetailProps): ReactElement {
  const isLatest = shown.revision === plan.latest.revision;
  const planHref = `/my-plans/${plan.id}?studentId=${studentId}`;
  const revisionHref = (revision: number): string =>
    revision === plan.latest.revision ? planHref : `${planHref}&revision=${String(revision)}`;
  // TODO(#415): link to /ask-an-advisor?planId= once the ask-an-advisor route is on main.
  const isHistory = !isLatest || shown.freshness.state !== 'CURRENT';
  return (
    <>
      <h1>Plan for {termCode ?? 'this term (code not available)'}</h1>
      {isLatest ? null : (
        <p>
          <strong>{EARLIER_REVISION_LABEL}.</strong> {EARLIER_REVISION_NOTE}{' '}
          <Link href={planHref}>Go to the latest revision</Link>
        </p>
      )}
      <p>
        Revision {shown.revision}, saved <Timestamp iso={shown.createdAt} />
      </p>
      <p>{PLAN_BOUNDARY_NOTE}</p>
      <FreshnessBanner freshness={shown.freshness} />
      {isLatest ? (
        <RevalidateForm
          revalidateAction={revalidateAction}
          studentId={studentId}
          planId={plan.id}
          revision={shown.revision}
          hasSelection={shown.selectedSectionIds !== null}
        />
      ) : null}
      <p>
        <Link href={plannerHref}>Plan next term again</Link> to choose an option, or go back to{' '}
        <Link href={plansHref}>My plans</Link>.
      </p>
      <RevisionHistory
        revisions={plan.revisions}
        shownRevision={shown.revision}
        revisionHref={revisionHref}
      />
      <ResultSection revision={shown} isHistory={isHistory} renderResult={renderResult} />
    </>
  );
}
