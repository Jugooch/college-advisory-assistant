/**
 * @file Turns the model's named constraints into unconfirmed PREFERRED proposals. Pure.
 * @module @caa/api/modules/conversation-tool-proposals/conversation-tool-proposals.logic
 * @requirement FR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4)
 */
import type { ProposedConstraint } from '@caa/api-contract';
import { ConstraintStrength, type ScheduleConstraint } from '@caa/domain';

/**
 * Turns the model's constraints into unconfirmed PREFERRED proposals.
 *
 * @param constraints - The validated constraints the model named.
 * @returns One proposal per constraint, ranked in the order given.
 */
export function toProposals(constraints: readonly ScheduleConstraint[]): ProposedConstraint[] {
  // SAFETY: every proposal is PREFERRED and unconfirmed; a hard rule exists only when the
  // student chooses it in the planner form (ADR-0015 section 4, FR-08).
  return constraints.map((constraint, index) => ({
    constraint: { ...constraint, strength: ConstraintStrength.Preferred, priorityRank: index + 1 },
    confirmed: false as const,
  }));
}
