/**
 * @file The Help and cases list: the student's cases, newest first, each with its status in
 * words. A case whose detail couldn't be loaded still shows the status from the list.
 * @module @caa/web/features/advisor-cases/components/case-list
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { CaseView } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import { Timestamp } from '@/shared/components/timestamp';
import { describeCaseReason, describeCaseStatus } from '@/shared/utils/case-wording';

import type { CaseSummary } from '../utils/case-summary';
import type { WithdrawCaseState } from '../utils/withdraw-case-state';
import { CaseCard } from './case-card';

/** One case: its list row, and its full view when that loaded. */
export interface CaseEntry {
  readonly summary: CaseSummary;
  /** `null` when the case's detail couldn't be loaded. */
  readonly view: CaseView | null;
}

/** Props for {@link CaseList}. */
export interface CaseListProps {
  readonly entries: readonly CaseEntry[];
  /** Server action that withdraws a case. */
  readonly withdrawAction: (
    previous: WithdrawCaseState,
    formData: FormData,
  ) => Promise<WithdrawCaseState>;
  /** Link to the planner or My plans, offered when there are no cases. */
  readonly plansHref: string;
}

/** Shown in place of a case whose detail couldn't be loaded. */
export const DETAIL_UNAVAILABLE =
  'The details of this case couldn’t be loaded. The status above is from your case list. Reload the page to try again.';

/**
 * Renders the cases, or the empty state.
 *
 * @param props - The entries, the withdraw action, and the My plans link.
 * @returns The list.
 */
export function CaseList({ entries, withdrawAction, plansHref }: CaseListProps): ReactElement {
  if (entries.length === 0) {
    return (
      <p>
        You haven’t asked an advisor about anything yet. Open <Link href={plansHref}>My plans</Link>{' '}
        to ask about a draft, or report a problem with your record from the Overview.
      </p>
    );
  }
  return (
    <>
      {entries.map(({ summary, view }) =>
        view === null ? (
          <article key={summary.id} aria-labelledby={`case-${summary.id}-heading`}>
            <h3 id={`case-${summary.id}-heading`}>{describeCaseReason(summary.reason)}</h3>
            <p>
              <StatusBadge
                label={describeCaseStatus(summary.status).label}
                tone={describeCaseStatus(summary.status).tone}
              />
            </p>
            <p>
              Opened <Timestamp iso={summary.createdAt} />
            </p>
            <p>{DETAIL_UNAVAILABLE}</p>
          </article>
        ) : (
          <CaseCard key={summary.id} view={view} withdrawAction={withdrawAction} />
        ),
      )}
    </>
  );
}
