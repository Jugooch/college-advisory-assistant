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
import { SCHEDULE_REASON_STATE, type ScheduleIssue } from './schedule-issue.model';

/**
 * Reasons an undecided credit load gives, which leave a schedule option's feasibility UNKNOWN
 * because the credit load is one of its hard rules (ADR-0010 §3). The load check itself carries
 * the arithmetic, so the schedule check names the reason without a schedule issue.
 */
const UNKNOWN_LOAD_REASONS: readonly ReasonCode[] = [
  ReasonCode.CreditBoundsUndefined,
  ReasonCode.VariableCreditUnselected,
];

/**
 * Whether a `SCHEDULE_FEASIBILITY` check's issues explain its state: a PASS has none; any other
 * state has issues whose reasons all mean that state, and the check's own reason code is one
 * of them. An UNKNOWN whose reason is an undecided credit load may have no issue. A CONDITIONAL
 * schedule check is always rejected: no schedule reason means CONDITIONAL, and a schedule
 * depends on no future condition. Checks of other kinds aren't constrained here.
 *
 * @param check - The check's kind, state, reason code, and schedule issues.
 * @returns `true` when the issues agree with the check.
 */
function scheduleIssuesExplainCheck(check: {
  readonly kind: CheckKind;
  readonly state: CheckState;
  readonly reasonCode?: ReasonCode | undefined;
  readonly evidence?:
    { readonly scheduleIssues?: readonly ScheduleIssue[] | undefined } | undefined;
}): boolean {
  if (check.kind !== CheckKind.ScheduleFeasibility) return true;
  const issues = check.evidence?.scheduleIssues ?? [];
  if (check.state === CheckState.Pass) return issues.length === 0;
  const isUnknownLoad =
    check.state === CheckState.Unknown &&
    check.reasonCode !== undefined &&
    UNKNOWN_LOAD_REASONS.includes(check.reasonCode);
  return (
    issues.every((issue) => SCHEDULE_REASON_STATE[issue.reasonCode] === check.state) &&
    (isUnknownLoad || issues.some((issue) => issue.reasonCode === check.reasonCode))
  );
}

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
  // SAFETY: a PASS, FAIL, or CONDITIONAL load verdict is a known result about known numbers
  // (planning/08 §Authority and result semantics: the check-state table; §Constraint
  // formulation: L ≤ Σ credits ≤ U), so it needs its arithmetic. A null or absent creditLoad
  // means the load is unknown, which only an UNKNOWN check may say. CONDITIONAL is excluded
  // too: the load of a chosen candidate set depends on no future condition.
  .refine(
    (check) =>
      check.kind !== CheckKind.CreditLoad ||
      check.state === CheckState.Unknown ||
      (check.evidence?.creditLoad ?? null) !== null,
    {
      message: 'A CREDIT_LOAD check that is not UNKNOWN requires creditLoad evidence',
      path: ['evidence', 'creditLoad'],
    },
  )
  // SAFETY: the credit arithmetic shown beside a load check must agree with its state, so the
  // UI never shows a PASS over a total outside the bounds or an over-limit total that isn't.
  .refine((check) => creditLoadAgreesWithCheck(check), {
    message: 'creditLoad totals contradict the check state or reasonCode',
    path: ['evidence', 'creditLoad'],
  })
  // SAFETY: schedule conflicts are consequential facts, so they may only appear on the check
  // that evaluates them, never beside an unrelated dimension.
  .refine(
    (check) =>
      check.kind === CheckKind.ScheduleFeasibility || check.evidence?.scheduleIssues === undefined,
    {
      message: 'Only SCHEDULE_FEASIBILITY checks may have scheduleIssues',
      path: ['evidence', 'scheduleIssues'],
    },
  )
  // SAFETY: a FAIL or UNKNOWN schedule must name what failed or is missing from structured
  // fields (FR-10), a PASS must show no conflict beside it, and an issue meaning UNKNOWN (such
  // as an undefined transition time) can never explain a FAIL or be hidden under a PASS.
  .refine(scheduleIssuesExplainCheck, {
    message:
      'A non-passing SCHEDULE_FEASIBILITY check needs scheduleIssues that agree with its state and reasonCode (an undecided credit load excepted), and a PASS has none',
    path: ['evidence', 'scheduleIssues'],
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
