/**
 * @file Compares one recorded grade with a required minimum grade under an institution's policy.
 * @module @caa/engine/verification/compare-to-minimum-grade
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  CheckState,
  type Grade,
  GradeScheme,
  type LetterGrade,
  PassFailGrade,
  ReasonCode,
} from '@caa/domain';

import { rankLetterGrade } from './rank-letter-grade';

/** Outcome of {@link compareToMinimumGrade}. Anything short of PASS says why. */
export type GradeComparisonResult =
  | { readonly state: typeof CheckState.Pass }
  | {
      readonly state: typeof CheckState.Fail | typeof CheckState.Unknown;
      readonly reasonCode: ReasonCode;
    };

const PASS: GradeComparisonResult = { state: CheckState.Pass };
const NOT_MET: GradeComparisonResult = {
  state: CheckState.Fail,
  reasonCode: ReasonCode.MinGradeNotMet,
};
const NOT_RANKED: GradeComparisonResult = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.GradeNotRanked,
};
const MISMATCH: GradeComparisonResult = {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.GradeSchemeMismatch,
};

/**
 * Compares a recorded grade with a required minimum grade.
 *
 * Letter grades are ranked only by `policy.letterGradeOrder`; the engine has no built-in scale.
 * `NUMERIC` and `UNKNOWN` grades are never compared, so they are always UNKNOWN.
 *
 * @param grade - The grade recorded on a completed or awarded attempt.
 * @param minimum - The required minimum grade, or `null` when the rule sets no minimum.
 * @param policy - The institution's grade policy for the ruleset in force.
 * @returns PASS, FAIL (`MIN_GRADE_NOT_MET`), or UNKNOWN (`GRADE_SCHEME_MISMATCH`,
 *   `GRADE_NOT_RANKED`, or `PASS_EQUIVALENCE_UNDEFINED`).
 */
export function compareToMinimumGrade(
  grade: Grade,
  minimum: Grade | null,
  policy: AcademicPolicy,
): GradeComparisonResult {
  // SAFETY: the engine has no approved meaning for numeric or unrecognized grades, so it can't
  // say whether they pass, even with no minimum (planning/08 §Candidate formation: preserve
  // grade schemes).
  if (grade.scheme === GradeScheme.Numeric || grade.scheme === GradeScheme.Unknown) {
    return MISMATCH;
  }
  // SAFETY: an `F`, letter or pass/fail, never satisfies a course requirement, whatever the
  // minimum; "no minimum" means any passing completion, not any completion.
  if (grade.value === PassFailGrade.Fail) {
    return NOT_MET;
  }
  if (minimum === null) {
    return PASS;
  }
  if (minimum.scheme === GradeScheme.Letter) {
    return grade.scheme === GradeScheme.Letter
      ? compareLetters(grade.value, minimum.value, policy)
      : comparePassToLetter(policy);
  }
  if (minimum.scheme === GradeScheme.PassFail && minimum.value === PassFailGrade.Pass) {
    // SAFETY: whether a letter grade meets a `P` minimum is institution policy that the domain
    // doesn't carry yet, so it stays UNKNOWN (planning/08 §Eligibility semantics).
    return grade.scheme === GradeScheme.PassFail ? PASS : MISMATCH;
  }
  // SAFETY: an `F`, numeric, or unrecognized minimum has no approved comparison, so it stays
  // UNKNOWN rather than passing by default (planning/08 §Eligibility semantics).
  return MISMATCH;
}

/**
 * Compares two letters by the policy's letter order.
 *
 * @param grade - The recorded letter.
 * @param minimum - The required letter.
 * @param policy - Supplies the letter order.
 * @returns PASS when the grade ranks at or above the minimum, FAIL below it, UNKNOWN
 *   (`GRADE_NOT_RANKED`) when either letter is missing from the order.
 */
function compareLetters(
  grade: LetterGrade,
  minimum: LetterGrade,
  policy: AcademicPolicy,
): GradeComparisonResult {
  const gradeRank = rankLetterGrade(grade, policy);
  const minimumRank = rankLetterGrade(minimum, policy);
  // SAFETY: a letter the institution didn't rank has no known position, so the comparison is
  // UNKNOWN rather than guessed from a conventional scale (planning/08 §Eligibility semantics).
  if (gradeRank === null || minimumRank === null) {
    return NOT_RANKED;
  }
  return gradeRank >= minimumRank ? PASS : NOT_MET;
}

/**
 * Applies the policy's pass-equivalence switch to a `P` grade against a letter minimum.
 *
 * @param policy - Supplies `passSatisfiesMinimumGrade`.
 * @returns PASS or FAIL when the policy decides, UNKNOWN when it is silent.
 */
function comparePassToLetter(policy: AcademicPolicy): GradeComparisonResult {
  // SAFETY: "P" is not a numeric C unless institutional policy says so; silence is UNKNOWN,
  // never PASS (planning/08 §Candidate formation; AC19).
  if (policy.passSatisfiesMinimumGrade === null) {
    return { state: CheckState.Unknown, reasonCode: ReasonCode.PassEquivalenceUndefined };
  }
  return policy.passSatisfiesMinimumGrade ? PASS : NOT_MET;
}
