/**
 * @file Finds the requirement whose audit state decides a candidate, reading its ancestors' own states.
 * @module @caa/engine/verification/find-deciding-requirement
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { type AuditSnapshot, type RequirementResult, RequirementState } from '@caa/domain';

/** The state that decides a candidate requirement, and the requirement that holds it. */
export interface DecidingRequirement {
  readonly state: RequirementState;
  /** The candidate itself or one of its ancestors; named in the check's `sourceRef`. */
  readonly requirement: RequirementResult;
}

/** Looks up the deciding requirement of a candidate in one audit. */
export type DecidingRequirementLookup = (candidate: RequirementResult) => DecidingRequirement;

// SAFETY: along a candidate's chain of ancestors the most settled state wins: AMBIGUOUS, then
// COMPLETE, then IN_PROGRESS, then INCOMPLETE. A course advances something outstanding only if
// the candidate and every ancestor are outstanding. In a "choose N of M" block a COMPLETE
// parent can leave a child INCOMPLETE indefinitely, and an IN_PROGRESS parent will be satisfied
// if its in-progress work finishes, so the child's course would add nothing. Each state is the
// audit's own statement about that ancestor; no parent is ever marked satisfied from its
// children (requirement-result.model.ts; planning/08 §Authority and result semantics).
const CHAIN_PRECEDENCE: readonly RequirementState[] = [
  RequirementState.Ambiguous,
  RequirementState.Complete,
  RequirementState.InProgress,
  RequirementState.Incomplete,
];

/**
 * Creates the lookup from a candidate requirement to the requirement that decides it.
 *
 * @param audit - The audit whose requirement tree is walked.
 * @returns A lookup giving, for a candidate, the most settled state on its chain from itself
 *   up to its root, and the nearest requirement with that state. A chain with a missing or
 *   repeated parent is AMBIGUOUS, decided by the candidate.
 */
export function createDecidingRequirementLookup(audit: AuditSnapshot): DecidingRequirementLookup {
  const byId = new Map(
    audit.requirements.map((requirement) => [requirement.sourceRequirementId, requirement]),
  );
  return (candidate) => {
    const chain = chainOf(candidate, byId);
    // SAFETY: the domain schema rejects dangling and cyclic parents; if one gets through, the
    // audit hasn't settled the tree, so the candidate is UNKNOWN, never PASS.
    if (chain === null) {
      return { state: RequirementState.Ambiguous, requirement: candidate };
    }
    // NOTE: ties keep the earlier, so the nearest requirement with the winning state is named.
    const requirement = chain.reduce((decided, node) =>
      CHAIN_PRECEDENCE.indexOf(node.state) < CHAIN_PRECEDENCE.indexOf(decided.state)
        ? node
        : decided,
    );
    return { state: requirement.state, requirement };
  };
}

/**
 * Lists a requirement and its ancestors, nearest first.
 *
 * @param requirement - The starting requirement.
 * @param byId - Every requirement of the audit by `sourceRequirementId`.
 * @returns The chain up to the root, or `null` when a parent is missing or repeats.
 */
function chainOf(
  requirement: RequirementResult,
  byId: ReadonlyMap<string, RequirementResult>,
): readonly RequirementResult[] | null {
  const chain = [requirement];
  let parentId = requirement.parentSourceRequirementId;
  while (parentId !== null) {
    const parent = byId.get(parentId);
    if (parent === undefined || chain.includes(parent)) {
      return null;
    }
    chain.push(parent);
    parentId = parent.parentSourceRequirementId;
  }
  return chain;
}
