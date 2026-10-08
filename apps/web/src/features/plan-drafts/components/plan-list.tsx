/**
 * @file The My plans list: one row per term with the latest revision, its freshness as text, and
 * the open advisor case. Rows are shown as the API returned them.
 * @module @caa/web/features/plan-drafts/components/plan-list
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { PlannableTerm, PlanSummary } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

import { describeOpenCase } from '../utils/plan-wording';
import { PlanFreshness } from './plan-freshness';

/** Props for {@link PlanList}. */
export interface PlanListProps {
  readonly plans: readonly PlanSummary[];
  /** Terms the planner knows, used only to name each plan's term; `null` when unavailable. */
  readonly terms: readonly PlannableTerm[] | null;
  /** Link to the planner, offered when there are no plans. */
  readonly plannerHref: string;
}

/** Shown when a plan's term isn't in the plannable terms. */
const UNNAMED_TERM = 'Term (code not available)';

/**
 * Renders the student's plans, or the empty state.
 *
 * @param props - The plans, the term names, and the planner link.
 * @returns The plans section.
 */
export function PlanList({ plans, terms, plannerHref }: PlanListProps): ReactElement {
  if (plans.length === 0) {
    return (
      <p>
        You haven’t saved a draft yet. <Link href={plannerHref}>Plan next term</Link>, then save an
        option as a draft.
      </p>
    );
  }
  const codes = new Map((terms ?? []).map((term) => [term.id, term.termCode]));
  return (
    <table>
      <caption>Your saved drafts, one per term</caption>
      <thead>
        <tr>
          <th scope="col">Term</th>
          <th scope="col">Latest revision</th>
          <th scope="col">Freshness</th>
          <th scope="col">Advisor case</th>
        </tr>
      </thead>
      <tbody>
        {plans.map((plan) => (
          <tr key={plan.id}>
            <th scope="row">{codes.get(plan.termId) ?? UNNAMED_TERM}</th>
            <td>
              Revision {plan.latestRevision}, saved <Timestamp iso={plan.createdAt} />
            </td>
            <td>
              <PlanFreshness freshness={plan.freshness} />
            </td>
            <td>{describeOpenCase(plan.openCaseStatus)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
