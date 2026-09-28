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
import { ReasonCode, ReasonCodeSchema } from '../enums/reason-code.enum';
import { CheckEvidenceSchema, type CreditLoadEvidence } from './check-evidence.model';

/** Check kinds that evaluate a course rule expression, so they can have decisive leaves. */
const EXPRESSION_CHECK_KINDS: readonly CheckKind[] = [
  CheckKind.Prerequisite,
  CheckKind.Corequisite,
];

/**
 * Whether a check's credit-load evidence agrees with its state and reason code: a PASS total is
 * within the bounds, an over-limit total exceeds the maximum, and an under-minimum total is
 * below the minimum. Other states and reasons (for example UNKNOWN) aren't constrained.
 *
 * @param check - The check's state, reason code, and evidence.
 * @returns `true` when there is no credit-load evidence or it agrees.
 */
function creditLoadAgreesWithCheck(check: {
  readonly state: CheckState;
  readonly reasonCode?: ReasonCode | undefined;
  readonly evidence?: { readonly creditLoad?: CreditLoadEvidence | null | undefined } | undefined;
}): boolean {
  const load = check.evidence?.creditLoad ?? null;
  if (load === null) {
    return true;
  }
  const {
    totalCreditsHundredths: total,
    minCreditsHundredths: min,
    maxCreditsHundredths: max,
  } = load;
  if (check.state === CheckState.Pass) {
    return min <= total && total <= max;
  }
  if (check.reasonCode === ReasonCode.CreditLimitExceeded) {
    return total > max;
  }
  if (check.reasonCode === ReasonCode.CreditBelowMinimum) {
    return total < min;
  }
  return true;
}

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
  // SAFETY: credit arithmetic is a consequential academic fact, so it may only appear on the
  // check that evaluates it and never as stray numbers beside an unrelated dimension. An
  // explicit null is held to the same rule, since it claims the load is unknown.
  .refine(
    (check) => check.kind === CheckKind.CreditLoad || check.evidence?.creditLoad === undefined,
    {
      message: 'Only CREDIT_LOAD checks may have creditLoad evidence',
      path: ['evidence', 'creditLoad'],
    },
  )
  // SAFETY: the credit arithmetic shown beside a load check must agree with its state, so the
  // UI never shows a PASS over a total outside the bounds or an over-limit total that isn't.
  .refine((check) => creditLoadAgreesWithCheck(check), {
    message: 'creditLoad totals contradict the check state or reasonCode',
    path: ['evidence', 'creditLoad'],
  })
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
 *   evidence contradicts the check's kind, state, or reasonCode.
 */
export function createCheckResult(input: CheckResultInput): CheckResult {
  return CheckResultSchema.parse(input);
}
