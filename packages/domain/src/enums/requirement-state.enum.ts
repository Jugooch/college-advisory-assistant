/**
 * @file State of one degree requirement as reported by the authoritative audit.
 * @module @caa/domain/enums/requirement-state
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * State of a requirement, taken from the audit and never recomputed by the app.
 *
 * Mapping contract to check states (planning/08 §Authority and result semantics):
 * - `COMPLETE`: satisfied; nothing remains. May support a PASS.
 * - `IN_PROGRESS`: would be satisfied only if in-progress attempts finish as required. Maps to
 *   CONDITIONAL, never PASS.
 * - `INCOMPLETE`: something remains to be done. The requirement is outstanding.
 * - `AMBIGUOUS`: the audit doesn't settle the requirement. Maps to UNKNOWN
 *   (`AUDIT_AMBIGUOUS`), never PASS.
 */
export const RequirementState = {
  Complete: 'COMPLETE',
  InProgress: 'IN_PROGRESS',
  Incomplete: 'INCOMPLETE',
  Ambiguous: 'AMBIGUOUS',
} as const;

/** Union of every {@link RequirementState} value. */
export type RequirementState = (typeof RequirementState)[keyof typeof RequirementState];

/** Runtime schema for {@link RequirementState}. */
export const RequirementStateSchema = z.enum(RequirementState);
