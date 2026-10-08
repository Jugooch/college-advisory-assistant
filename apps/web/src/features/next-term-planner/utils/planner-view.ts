/**
 * @file Decides which planner step the page shows from the query, the plan, and the search
 * outcome. A search runs only for the confirm step, so no constraint becomes a hard exclusion
 * before the student has reviewed it.
 * @module @caa/web/features/next-term-planner/utils/planner-view
 * @requirement FR-08
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { ApiError, type ScheduleOptionsResponse } from '@caa/api-contract';

import { describeConstraints, type ReviewedConstraint } from '@/shared/utils/constraint-wording';
import { PlannerStep } from '@/shared/utils/planner-query-names';

import type { PlannerIssue, PlannerPlan } from './planner-plan';

/** What the planner page shows. */
export type PlannerView =
  /** The form, with the issues that sent the student back to it. */
  | { readonly kind: 'form'; readonly issues: readonly PlannerIssue[] }
  /** Every constraint in words, to confirm before searching. */
  | { readonly kind: 'review'; readonly constraints: readonly ReviewedConstraint[] }
  /** The search was confirmed and finished. */
  | {
      readonly kind: 'searched';
      readonly constraints: readonly ReviewedConstraint[];
      readonly result: ScheduleOptionsResponse;
    }
  /** The search was confirmed and failed; the confirmed constraints stay for the retry. */
  | {
      readonly kind: 'search-failed';
      readonly constraints: readonly ReviewedConstraint[];
      readonly error: ApiError;
    };

/**
 * Whether the page must call the API: only a confirmed, valid search.
 *
 * @param step - The requested step.
 * @param plan - The plan of the typed values.
 * @returns `true` when the search should run.
 */
export function isSearchRequested(step: PlannerStep, plan: PlannerPlan): boolean {
  return step === PlannerStep.Search && plan.request !== null;
}

/**
 * The request the student confirmed, for the chat panel to pass along. Unconfirmed form values
 * are never shared.
 *
 * @param step - The requested step.
 * @param plan - The plan of the typed values.
 * @returns The request once the student confirmed a valid search, otherwise `null`.
 */
export function confirmedRequest(step: PlannerStep, plan: PlannerPlan): PlannerPlan['request'] {
  return step === PlannerStep.Search ? plan.request : null;
}

/**
 * Plans the view.
 *
 * @param step - The requested step.
 * @param plan - The plan of the typed values; unused for the edit step.
 * @param outcome - The search's outcome, or null when none ran.
 * @returns What to render.
 */
export function planPlannerView(
  step: PlannerStep,
  plan: PlannerPlan,
  outcome: ScheduleOptionsResponse | ApiError | null,
): PlannerView {
  if (step === PlannerStep.Edit) {
    return { kind: 'form', issues: [] };
  }
  if (plan.request === null) {
    return { kind: 'form', issues: plan.issues };
  }
  const constraints = describeConstraints(plan.constraints);
  if (outcome === null) {
    return { kind: 'review', constraints };
  }
  return outcome instanceof ApiError
    ? { kind: 'search-failed', constraints, error: outcome }
    : { kind: 'searched', constraints, result: outcome };
}
