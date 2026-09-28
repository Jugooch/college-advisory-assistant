/**
 * @file Check result data object: one validation check and the evidence behind it.
 * @module @caa/domain/models/check-result
 * @requirement FR-09
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { CheckKind, CheckKindSchema } from '../enums/check-kind.enum';
import { CheckState, CheckStateSchema } from '../enums/check-state.enum';
import { PrerequisiteExpressionType } from '../enums/prerequisite-expression-type.enum';
import { ReasonCodeSchema } from '../enums/reason-code.enum';
import { CheckEvidenceSchema } from './check-evidence.model';

/** Check kinds that evaluate a course rule expression, so they can have decisive leaves. */
const EXPRESSION_CHECK_KINDS: readonly CheckKind[] = [
  CheckKind.Prerequisite,
  CheckKind.Corequisite,
];

/** Schema for a single validation check result. */
export const CheckResultSchema = z
  .object({
    kind: CheckKindSchema,
    state: CheckStateSchema,
    /** Why the check did not pass, from the closed {@link ReasonCodeSchema} registry. */
    reasonCode: ReasonCodeSchema.optional(),
    sourceRef: z.string().min(1).optional(),
    /**
     * The evidence behind the check. Omitted when the producer attaches none; that says
     * nothing about the check's state.
     */
    evidence: CheckEvidenceSchema.optional(),
  })
  // SAFETY: anything short of PASS must say why, so the UI never shows an unexplained state.
  .refine((check) => check.state === CheckState.Pass || check.reasonCode !== undefined, {
    message: 'Non-passing checks require a reasonCode',
    path: ['reasonCode'],
  })
  .refine(
    (check) =>
      EXPRESSION_CHECK_KINDS.includes(check.kind) ||
      (check.evidence?.decisiveLeaves.length ?? 0) === 0,
    {
      message: 'Only PREREQUISITE and COREQUISITE checks may have decisiveLeaves',
      path: ['evidence', 'decisiveLeaves'],
    },
  )
  // SAFETY: a decisive leaf has the check's state, so it explains a non-passing check and a
  // passing check has nothing to explain; a mismatch would show a reason beside a PASS.
  .refine(
    (check) =>
      (check.evidence?.decisiveLeaves ?? []).every(
        (leaf) => (leaf.reasonCode === null) === (check.state === CheckState.Pass),
      ),
    {
      message: 'Decisive leaves have a reasonCode exactly when the check is not PASS',
      path: ['evidence', 'decisiveLeaves'],
    },
  )
  // SAFETY: rule text the app can't represent never decides a PASS, FAIL, or CONDITIONAL.
  .refine(
    (check) =>
      check.state === CheckState.Unknown ||
      (check.evidence?.decisiveLeaves ?? []).every(
        (leaf) => leaf.type !== PrerequisiteExpressionType.Unsupported,
      ),
    {
      message: 'An UNSUPPORTED decisive leaf requires an UNKNOWN check',
      path: ['evidence', 'decisiveLeaves'],
    },
  )
  .readonly();

/** A validated, immutable check result. */
export type CheckResult = z.infer<typeof CheckResultSchema>;

/** Raw input accepted by {@link createCheckResult}. */
export type CheckResultInput = z.input<typeof CheckResultSchema>;

/**
 * Creates a validated, immutable check result.
 *
 * @param input - Raw check fields.
 * @returns The parsed check result.
 * @throws {z.ZodError} When a field is invalid, a non-passing check has no reasonCode, or the
 *   evidence contradicts the check's kind or state.
 */
export function createCheckResult(input: CheckResultInput): CheckResult {
  return CheckResultSchema.parse(input);
}
