/**
 * @file Derives a plan's aggregate state from its individual check states.
 * @module @caa/engine/verification/aggregate-check-states
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { AggregateState, CheckState } from '@caa/domain';

/**
 * Derives the aggregate state using the fixed precedence FAIL, then UNKNOWN, then CONDITIONAL, then PASS.
 *
 * @param states - The state of every check that applies to the plan.
 * @returns The aggregate state. An empty list is NEEDS_VERIFICATION, never VALIDATED.
 */
export function aggregateCheckStates(states: readonly CheckState[]): AggregateState {
  // SAFETY: no evidence is not a pass. An empty check list must not produce VALIDATED.
  if (states.length === 0) {
    return AggregateState.NeedsVerification;
  }
  if (states.includes(CheckState.Fail)) {
    return AggregateState.Blocked;
  }
  if (states.includes(CheckState.Unknown)) {
    return AggregateState.NeedsVerification;
  }
  if (states.includes(CheckState.Conditional)) {
    return AggregateState.Conditional;
  }
  return AggregateState.Validated;
}
