/**
 * @file Checks a candidate set's credit total against the term's credit bounds, in exact hundredths.
 * @module @caa/engine/verification/check-credit-load
 * @requirement FR-06
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  CheckKind,
  type CheckResult,
  CheckState,
  type CourseId,
  createCheckResult,
  type CreditLoadEvidence,
  ReasonCode,
  type TermCreditBounds,
} from '@caa/domain';

import {
  assertValidCandidateSet,
  CandidateSetInputError,
  type CourseSelection,
  selectedCreditsOf,
} from './candidate-set';

/** Where a load check's bounds come from: the policy's reference and ruleset version. */
interface LoadSource {
  readonly sourceRef: string;
  readonly rulesetVersion: string;
}

/**
 * Checks the credit load of a candidate set against the term credit bounds of the academic
 * policy (`policy.termCreditBounds`).
 *
 * Credits are summed as exact integer hundredths over the selections with `countsCredits`
 * (see {@link CourseSelection} for linked sections). Then:
 * 1. The policy has no credit bounds: UNKNOWN (`CREDIT_BOUNDS_UNDEFINED`), naming every
 *    selection, with `creditLoad: null`.
 * 2. A credit-bearing variable-credit course has no chosen value: UNKNOWN
 *    (`VARIABLE_CREDIT_UNSELECTED`), naming those courses, with `creditLoad: null`.
 * 3. The total is above the maximum: FAIL (`CREDIT_LIMIT_EXCEEDED`).
 * 4. The total is below the minimum: FAIL (`CREDIT_BELOW_MINIMUM`).
 * 5. Otherwise PASS. Both bounds are inclusive.
 *
 * The bounds apply to the whole set as one load period; there are no defaults. The same inputs
 * always give a deep-equal result.
 *
 * @param selections - The candidate set.
 * @param policy - The academic policy that supplies the term credit bounds.
 * @returns A CREDIT_LOAD check whose `sourceRef` is `<rulesetVersion>:termCreditBounds` and
 *   whose evidence names the ruleset version, the courses (all selections in input order, or
 *   the unselected ones) and, unless UNKNOWN, the total and bounds.
 * @throws {CandidateSetInputError} When the set is malformed (see `assertValidCandidateSet`),
 *   a bound isn't a non-negative safe integer or the minimum exceeds the maximum (`bounds`), or
 *   the total isn't a safe integer (`totalCredits`).
 */
export function checkCreditLoad(
  selections: readonly CourseSelection[],
  policy: AcademicPolicy,
): CheckResult {
  const source: LoadSource = {
    sourceRef: `${policy.rulesetVersion}:termCreditBounds`,
    rulesetVersion: policy.rulesetVersion,
  };
  const bounds = policy.termCreditBounds;
  // SAFETY: without institution-approved bounds there is nothing to compare the load with, so
  // the check is UNKNOWN, never a PASS against an assumed load such as 12 or 18 credits. It is
  // reported before an unchosen variable credit, because choosing one wouldn't settle it
  // (planning/08 §Constraint formulation: L ≤ Σ credits ≤ U from institution policy;
  // §Authority and result semantics: missing data is UNKNOWN).
  if (bounds === null) {
    assertValidCandidateSet(selections);
    return toCheck(
      { state: CheckState.Unknown, reasonCode: ReasonCode.CreditBoundsUndefined },
      source,
      { courseIds: selections.map((selection) => selection.course.id), creditLoad: null },
    );
  }
  return checkAgainstBounds(selections, bounds, source);
}

/**
 * Checks the credit load against known bounds, steps 2 to 5 of {@link checkCreditLoad}.
 *
 * @param selections - The candidate set.
 * @param bounds - The minimum and maximum load.
 * @param source - The bounds' reference and ruleset version.
 * @returns The CREDIT_LOAD check.
 * @throws {CandidateSetInputError} As {@link checkCreditLoad} documents.
 */
function checkAgainstBounds(
  selections: readonly CourseSelection[],
  bounds: TermCreditBounds,
  source: LoadSource,
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
      source,
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
  return toCheck(creditLoadOutcomeOf(creditLoad), source, { courseIds, creditLoad });
}

/** The state and reason of a load check. */
export interface LoadOutcome {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

/**
 * Compares a known total with inclusive bounds: the one rule every credit-load decision uses,
 * including the schedule solver's search, so the two never disagree.
 *
 * @param load - The total and the bounds.
 * @returns FAIL above the maximum or below the minimum, otherwise PASS.
 */
export function creditLoadOutcomeOf(load: CreditLoadEvidence): LoadOutcome {
  if (load.totalCreditsHundredths > load.maxCreditsHundredths) {
    return { state: CheckState.Fail, reasonCode: ReasonCode.CreditLimitExceeded };
  }
  if (load.totalCreditsHundredths < load.minCreditsHundredths) {
    return { state: CheckState.Fail, reasonCode: ReasonCode.CreditBelowMinimum };
  }
  return { state: CheckState.Pass, reasonCode: null };
}

/**
 * Checks the policy's bounds, which may have bypassed the schema.
 *
 * @param bounds - The bounds to check.
 * @throws {CandidateSetInputError} When a bound is invalid.
 */
function assertValidBounds(bounds: TermCreditBounds): void {
  const { minCreditsHundredths: min, maxCreditsHundredths: max } = bounds;
  // SAFETY: a missing, fractional, negative, or inverted bound would silently disable or
  // invert the load rule, so it is rejected instead of defaulted (planning/08 §Constraint
  // formulation: L ≤ Σ credits ≤ U from institution policy).
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min > max) {
    throw new CandidateSetInputError('bounds');
  }
}

/**
 * Builds the credit-load check.
 *
 * @param outcome - The check's state and reason code.
 * @param source - The bounds' reference and ruleset version.
 * @param evidence - The courses named and the credit arithmetic, if known.
 * @returns The validated check.
 */
function toCheck(
  outcome: LoadOutcome,
  source: LoadSource,
  evidence: {
    readonly courseIds: readonly CourseId[];
    readonly creditLoad: CreditLoadEvidence | null;
  },
): CheckResult {
  return createCheckResult({
    kind: CheckKind.CreditLoad,
    state: outcome.state,
    sourceRef: source.sourceRef,
    ...(outcome.reasonCode === null ? {} : { reasonCode: outcome.reasonCode }),
    evidence: { rulesetVersion: source.rulesetVersion, decisiveLeaves: [], ...evidence },
  });
}
