/**
 * @file Whether one attempt of a course counts after attempt resolution.
 * @module @caa/domain/enums/counting-state
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Outcome of choosing the counting attempt among all attempts of one course.
 *
 * - `COUNTED`: exactly one attempt counts.
 * - `NONE`: no completed or awarded attempt exists, so nothing counts and no credit is earned.
 * - `UNDETERMINED`: the counting attempt can't be decided without guessing, so the engine
 *   surfaces a reason code (for example `REPEAT_POLICY_UNDEFINED`) and never treats it as PASS.
 */
export const CountingState = {
  Counted: 'COUNTED',
  None: 'NONE',
  Undetermined: 'UNDETERMINED',
} as const;

/** Union of every {@link CountingState} value. */
export type CountingState = (typeof CountingState)[keyof typeof CountingState];

/** Runtime schema for {@link CountingState}. */
export const CountingStateSchema = z.enum(CountingState);
