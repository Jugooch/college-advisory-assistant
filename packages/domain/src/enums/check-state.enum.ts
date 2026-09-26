/**
 * @file Validation check states and the plan-level aggregate states derived from them.
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
