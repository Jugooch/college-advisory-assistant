/**
 * @file Checks a candidate set's credit total against the term's credit bounds, in exact hundredths.
 * @module @caa/engine/verification/check-credit-load
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  type CourseId,
  createCheckResult,
  type CreditLoadEvidence,
  ReasonCode,
} from '@caa/domain';

import {
  assertValidCandidateSet,
  CandidateSetInputError,
  type CourseSelection,
  selectedCreditsOf,
} from './candidate-set';

/** The institution's credit-load policy for the period the candidate set is taken in. */
export interface CreditLoadBounds {
  /** Minimum load in hundredths of a credit (1200 = 12.00 credits). */
  readonly minCreditsHundredths: number;
  /** Maximum load in hundredths of a credit; at least the minimum. */
  readonly maxCreditsHundredths: number;
  /** Reference to the policy the bounds come from, shown as the check's `sourceRef`. */
  readonly sourceRef: string;
}

/**
 * Checks the credit load of a candidate set against the caller's bounds.
 *
 * Credits are summed as exact integer hundredths over the selections with `countsCredits`
 * (see {@link CourseSelection} for linked sections). Then:
 * 1. A credit-bearing variable-credit course has no chosen value: UNKNOWN
 *    (`VARIABLE_CREDIT_UNSELECTED`), naming those courses, with `creditLoad: null`.
 * 2. The total is above the maximum: FAIL (`CREDIT_LIMIT_EXCEEDED`).
 * 3. The total is below the minimum: FAIL (`CREDIT_BELOW_MINIMUM`).
 * 4. Otherwise PASS. Both bounds are inclusive.
 *
 * The bounds apply to the whole set as one load period. The caller passes bounds from the
 * institution's approved load policy, including for overlapping short sessions; there are no
 * defaults. The same inputs always give a deep-equal result.
 *
 * @param selections - The candidate set.
 * @param bounds - The minimum and maximum load and the policy they come from.
 * @returns A CREDIT_LOAD check with `sourceRef` set to the policy reference. Its evidence names
 *   the courses (all selections in input order, or the unselected ones) and, unless UNKNOWN,
 *   the total and bounds.
 * @throws {CandidateSetInputError} When the set is malformed (see `assertValidCandidateSet`),
 *   a bound isn't a non-negative safe integer or the minimum exceeds the maximum (`bounds`),
 *   the policy reference is empty (`boundsSourceRef`), or the total isn't a safe integer
 *   (`totalCredits`).
 */
export function checkCreditLoad(
  selections: readonly CourseSelection[],
  bounds: CreditLoadBounds,
): CheckResult {
  assertValidBounds(bounds);
  assertValidCandidateSet(selections);
  const bearing = selections.filter((selection) => selection.countsCredits);
  // SAFETY: an unchosen variable credit value is unknown, never its minimum, maximum, or a
  // typical value, so the load can't be decided either way (planning/08 §Candidate formation:
  // do not assume credit values; AC18).
  const unselected = bearing.filter((selection) => selectedCreditsOf(selection) === null);
  const known = bearing.flatMap((selection) => selectedCreditsOf(selection) ?? []);
  if (unselected.length > 0) {
    return toCheck(
      { state: CheckState.Unknown, reasonCode: ReasonCode.VariableCreditUnselected },
      bounds.sourceRef,
      { courseIds: unselected.map((selection) => selection.course.id), creditLoad: null },
    );
  }
  // SAFETY: included linked sections (`countsCredits: false`) add nothing, so credits a
  // course's total already covers aren't counted twice (planning/08 §Constraint formulation).
  const total = known.reduce((sum, credits) => sum + credits, 0);
  if (!Number.isSafeInteger(total)) {
    throw new CandidateSetInputError('totalCredits');
  }
  const creditLoad: CreditLoadEvidence = {
    totalCreditsHundredths: total,
    minCreditsHundredths: bounds.minCreditsHundredths,
    maxCreditsHundredths: bounds.maxCreditsHundredths,
  };
  const courseIds = selections.map((selection) => selection.course.id);
  return toCheck(outcomeOf(creditLoad), bounds.sourceRef, { courseIds, creditLoad });
}

/** The state and reason of a load check. */
interface LoadOutcome {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

/**
 * Compares a known total with the bounds.
 *
 * @param load - The total and the bounds.
 * @returns FAIL above the maximum or below the minimum, otherwise PASS.
 */
function outcomeOf(load: CreditLoadEvidence): LoadOutcome {
  if (load.totalCreditsHundredths > load.maxCreditsHundredths) {
    return { state: CheckState.Fail, reasonCode: ReasonCode.CreditLimitExceeded };
  }
  if (load.totalCreditsHundredths < load.minCreditsHundredths) {
    return { state: CheckState.Fail, reasonCode: ReasonCode.CreditBelowMinimum };
  }
  return { state: CheckState.Pass, reasonCode: null };
}

/**
 * Checks the caller's bounds.
 *
 * @param bounds - The bounds to check.
 * @throws {CandidateSetInputError} When a bound is invalid or the reference is empty.
 */
function assertValidBounds(bounds: CreditLoadBounds): void {
  const { minCreditsHundredths: min, maxCreditsHundredths: max } = bounds;
  // SAFETY: a missing, fractional, negative, or inverted bound would silently disable or
  // invert the load rule, so it is rejected instead of defaulted (planning/08 §Constraint
  // formulation: L ≤ Σ credits ≤ U from institution policy).
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min > max) {
    throw new CandidateSetInputError('bounds');
  }
  if (bounds.sourceRef.length === 0) {
    throw new CandidateSetInputError('boundsSourceRef');
  }
}

/**
 * Builds the credit-load check.
 *
 * @param outcome - The check's state and reason code.
 * @param sourceRef - The policy reference.
 * @param evidence - The courses named and the credit arithmetic, if known.
 * @returns The validated check.
 */
function toCheck(
  outcome: LoadOutcome,
  sourceRef: string,
  evidence: {
    readonly courseIds: readonly CourseId[];
    readonly creditLoad: CreditLoadEvidence | null;
  },
): CheckResult {
  return createCheckResult({
    kind: CheckKind.CreditLoad,
    state: outcome.state,
    sourceRef,
    ...(outcome.reasonCode === null ? {} : { reasonCode: outcome.reasonCode }),
    evidence: { rulesetVersion: null, decisiveLeaves: [], ...evidence },
  });
}
