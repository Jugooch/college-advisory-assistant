/**
 * @file Validation check states, the plan-level aggregate states, and their precedence.
 * @module @caa/domain/enums/check-state
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * State of a single validation check.
 *
 * These four states are never collapsed into a numeric confidence score.
 */
export const CheckState = {
  Pass: 'PASS',
  Fail: 'FAIL',
  Unknown: 'UNKNOWN',
  Conditional: 'CONDITIONAL',
} as const;

/** Union of every {@link CheckState} value. */
export type CheckState = (typeof CheckState)[keyof typeof CheckState];

/** Runtime schema for {@link CheckState}. */
export const CheckStateSchema = z.enum(CheckState);

/** Overall state of a plan or course bundle, derived from its individual checks. */
export const AggregateState = {
  Blocked: 'BLOCKED',
  NeedsVerification: 'NEEDS_VERIFICATION',
  Conditional: 'CONDITIONAL',
  Validated: 'VALIDATED',
} as const;

/** Union of every {@link AggregateState} value. */
export type AggregateState = (typeof AggregateState)[keyof typeof AggregateState];

/** Runtime schema for {@link AggregateState}. */
export const AggregateStateSchema = z.enum(AggregateState);

/**
 * Derives the aggregate state of a set of checks with the fixed precedence of planning/08
 * §Authority and result semantics: any FAIL is BLOCKED, otherwise any UNKNOWN is
 * NEEDS_VERIFICATION, otherwise any CONDITIONAL is CONDITIONAL, otherwise VALIDATED.
 *
 * Shared invariant (ADR-0005): the single definition of this precedence. The course-checks
 * contract enforces it in a refine, and the engine's `aggregateCheckStates` will delegate to it
 * once #107 lands. Pure and total: it never throws.
 *
 * @param states - The state of every check that applies.
 * @returns The aggregate state. An empty list is NEEDS_VERIFICATION, never VALIDATED.
 */
export function deriveAggregateState(states: readonly CheckState[]): AggregateState {
  // SAFETY: no evidence is not a pass, so an empty check list must not produce VALIDATED
  // (planning/08 §Authority and result semantics: aggregate precedence).
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
