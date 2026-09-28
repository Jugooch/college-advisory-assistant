/**
 * @file Derives a plan's aggregate state from its individual check states.
 * @module @caa/engine/verification/aggregate-check-states
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0005-shared-invariant-functions-in-domain.md
 */
import { type AggregateState, type CheckState, deriveAggregateState } from '@caa/domain';

/**
 * Derives the aggregate state using the fixed precedence FAIL, then UNKNOWN, then CONDITIONAL,
 * then PASS. The precedence is the shared invariant `deriveAggregateState` (ADR-0005); this is
 * the engine's name for it, so there is one implementation.
 *
 * @param states - The state of every check that applies to the plan.
 * @returns The aggregate state. An empty list is NEEDS_VERIFICATION, never VALIDATED.
 */
export function aggregateCheckStates(states: readonly CheckState[]): AggregateState {
  // SAFETY: the precedence, including an empty list never being VALIDATED, is defined once in
  // @caa/domain and the engine never restates it (planning/08 §Authority and result semantics:
  // aggregate precedence; ADR-0005).
  return deriveAggregateState(states);
}
