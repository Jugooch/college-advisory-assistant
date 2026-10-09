/**
 * @file The minimized projections the model sees for each tool result: counts, states, and
 * quotable policy text, never names, emails, IDs, grades, credits, or notes. Pure.
 * @module @caa/api/modules/conversation-tool-projections/conversation-tool-projections.logic
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import type {
  AcademicSummaryResponse,
  PlanRevisionView,
  PolicySearchResponse,
  ProposedConstraint,
  ScheduleOptionsResponse,
} from '@caa/api-contract';
import { ConstraintStrength } from '@caa/domain';

import type { JsonValue } from '../conversation-tools/conversation-tools.logic';

/**
 * Counts values by key, in key order so the projection is stable.
 *
 * @param keys - One key per item.
 * @returns A count for each distinct key.
 */
function countBy(keys: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const key of [...keys].sort()) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

/**
 * Minimizes the academic summary: whether an audit exists, its verdict states, and counts of
 * requirements by state. No names, IDs, labels, or credits.
 *
 * @param summary - The verified summary.
 * @returns The model projection.
 */
export function projectAcademicSummary(summary: AcademicSummaryResponse): JsonValue {
  return {
    auditAvailable: summary.audit !== null,
    auditReflectsRecord: summary.auditReflectsRecord?.state ?? null,
    // SAFETY: an UNKNOWN program/catalog check means every requirement state needs verification
    // (academic summary contract), so the model must see it beside the counts.
    programCatalogConsistency: summary.programCatalogConsistency?.state ?? null,
    requirementCount: summary.requirements.length,
    requirementsByState: countBy(summary.requirements.map((requirement) => requirement.state)),
  };
}

/**
 * Minimizes policy results to the quotable text of each hit. Policy documents are institutional
 * text, not student data; document keys are left out.
 *
 * @param results - The search response.
 * @returns The model projection.
 */
export function projectPolicyResults(results: PolicySearchResponse): JsonValue {
  return {
    hitCount: results.hits.length,
    hits: results.hits.map((hit) => ({
      title: hit.title,
      topic: hit.topic,
      excerpt: hit.excerpt,
      conflict: hit.conflict,
    })),
  };
}

/**
 * Minimizes proposed constraints to a count.
 *
 * @param proposed - The proposals.
 * @returns The model projection.
 */
export function projectConstraintProposal(proposed: readonly ProposedConstraint[]): JsonValue {
  return {
    proposedCount: proposed.length,
    strength: ConstraintStrength.Preferred,
    confirmed: false,
  };
}

/**
 * Minimizes schedule options to the outcome and counts.
 *
 * @param result - The schedule options response.
 * @returns The model projection.
 */
export function projectScheduleOptions(result: ScheduleOptionsResponse): JsonValue {
  return {
    outcome: result.outcome,
    searchComplete: result.searchComplete,
    optionCount: result.options.length,
    hasConflictSet: result.conflictSet !== null,
    limitationCount: result.limitations.length,
  };
}

/**
 * Minimizes plan evidence to the revision number, outcome, and freshness.
 *
 * @param plan - The revision view.
 * @returns The model projection.
 */
export function projectPlanEvidence(plan: PlanRevisionView): JsonValue {
  // SAFETY: the stored outcome travels only beside its freshness, so a stale or unknown
  // revision never reads as current (planning/09 Freshness policies, ADR-0013 section 3).
  return {
    revision: plan.revision,
    outcome: plan.result?.outcome ?? null,
    resultUnavailable: plan.resultUnavailable,
    freshness: plan.freshness.state,
    staleReasonCount: plan.freshness.reasons.length,
  };
}
