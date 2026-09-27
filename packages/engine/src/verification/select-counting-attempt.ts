/**
 * @file Chooses which completed or awarded attempt counts when a course has been repeated.
 * @module @caa/engine/verification/select-counting-attempt
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  CountingState,
  type CourseAttempt,
  type Grade,
  GradeScheme,
  PassFailGrade,
  ReasonCode,
  RepeatPolicy,
} from '@caa/domain';

import { rankLetterGrade } from './rank-letter-grade';

/** Institution inputs needed to decide which attempt of a repeated course counts. */
export interface AttemptResolutionContext {
  /** Supplies `repeatPolicy` (`null` = undetermined) and the letter order for HIGHEST_GRADE. */
  readonly academicPolicy: AcademicPolicy;
  /**
   * The tenant's term codes, oldest first, used only by MOST_RECENT. Term codes don't sort
   * lexically across tenants, and there is no Term model yet (S3), so the order is explicit.
   */
  readonly termCodesOldestFirst: readonly string[];
}

/** Why a group's counting attempt is undetermined. */
export type UndeterminedCountingReason =
  | typeof ReasonCode.RepeatPolicyUndefined
  | typeof ReasonCode.RepeatOrderUndetermined
  | typeof ReasonCode.CourseNotInCatalog;

/**
 * The counting attempt of one group. `earnedCreditsHundredths` is integer hundredths of a
 * credit, taken only from the counting attempt's `creditsEarnedHundredths`; `null` is unknown.
 */
export type CountingResolution =
  | {
      readonly state: typeof CountingState.Counted;
      readonly attempt: CourseAttempt;
      readonly earnedCreditsHundredths: number | null;
    }
  | { readonly state: typeof CountingState.None; readonly earnedCreditsHundredths: 0 }
  | {
      readonly state: typeof CountingState.Undetermined;
      readonly reasonCode: UndeterminedCountingReason;
      readonly earnedCreditsHundredths: null;
    };

/**
 * Decides whether HIGHEST_GRADE can rank grades against each other: only grades of one scheme
 * are comparable. The prerequisite evaluator uses the same rule to decide whether a retake's
 * future grade will be rankable, so the two can't drift.
 *
 * @param schemes - The scheme of each grade; `undefined` for a grade that wasn't recorded.
 * @returns `true` when every grade has the same scheme. Unrecorded grades still get no rank.
 */
export function haveOneGradeScheme(schemes: readonly (GradeScheme | undefined)[]): boolean {
  return new Set(schemes).size === 1;
}

/**
 * Chooses the one attempt that counts among a group's completed or awarded attempts.
 *
 * @param completed - The group's COMPLETED and TRANSFER_AWARDED attempts.
 * @param context - The institution's repeat policy, letter order, and term order.
 * @returns The counting attempt, NONE when there is no candidate, or UNDETERMINED with a
 *   reason code.
 */
export function selectCountingAttempt(
  completed: readonly CourseAttempt[],
  context: AttemptResolutionContext,
): CountingResolution {
  // TODO(#66): count repeatable-for-credit courses once the domain models them
  const [first, ...rest] = completed;
  if (first === undefined) {
    return { state: CountingState.None, earnedCreditsHundredths: 0 };
  }
  if (rest.length === 0) {
    return counted(first);
  }
  const { repeatPolicy } = context.academicPolicy;
  // SAFETY: which repeat counts is institution policy. Without it the engine doesn't pick one,
  // so the group is undetermined (planning/08 §Eligibility semantics: repeated attempts use
  // approved source semantics).
  if (repeatPolicy === null) {
    return undeterminedCounting(ReasonCode.RepeatPolicyUndefined);
  }
  const rank =
    repeatPolicy === RepeatPolicy.MostRecent
      ? (attempt: CourseAttempt): number | null => rankByTerm(attempt, context.termCodesOldestFirst)
      : gradeRanker(completed, context.academicPolicy);
  const best = pickUniqueBest(completed, rank);
  return best === null ? undeterminedCounting(ReasonCode.RepeatOrderUndetermined) : counted(best);
}

/**
 * Builds an UNDETERMINED resolution.
 *
 * @param reasonCode - Why no attempt could be chosen.
 * @returns The resolution, with unknown earned credits.
 */
function undeterminedCounting(reasonCode: UndeterminedCountingReason): CountingResolution {
  return { state: CountingState.Undetermined, reasonCode, earnedCreditsHundredths: null };
}

/**
 * Builds a COUNTED resolution.
 *
 * @param attempt - The counting attempt.
 * @returns The resolution carrying the attempt's own earned credits.
 */
function counted(attempt: CourseAttempt): CountingResolution {
  // SAFETY: credits come only from the attempt's recorded award, never from the course's
  // nominal or variable-credit range; a missing award stays null (planning/08 §Candidate
  // formation: authoritative credit-award rules).
  return {
    state: CountingState.Counted,
    attempt,
    earnedCreditsHundredths: attempt.creditsEarnedHundredths,
  };
}

/**
 * Ranks an attempt by its term's position; later terms rank higher.
 *
 * @param attempt - The attempt to rank.
 * @param termCodesOldestFirst - The tenant's term order.
 * @returns The rank, or `null` when the term isn't in the order.
 */
function rankByTerm(
  attempt: CourseAttempt,
  termCodesOldestFirst: readonly string[],
): number | null {
  const index = termCodesOldestFirst.indexOf(attempt.termCode);
  return index === -1 ? null : index;
}

/**
 * Builds a grade ranker for a set of attempts; higher grades rank higher. Only grades of one
 * scheme are comparable.
 *
 * @param attempts - The attempts that will be ranked.
 * @param policy - Supplies the letter order.
 * @returns A function giving each attempt's rank, or `null` when it can't be ranked.
 */
function gradeRanker(
  attempts: readonly CourseAttempt[],
  policy: AcademicPolicy,
): (attempt: CourseAttempt) => number | null {
  // SAFETY: grades under different schemes, such as `P` and `B`, have no approved common scale
  // (planning/08 §Candidate formation: preserve grade schemes).
  if (!haveOneGradeScheme(attempts.map((attempt) => attempt.grade?.scheme))) {
    return () => null;
  }
  return (attempt) => rankGrade(attempt.grade, policy);
}

/**
 * Ranks one grade within its scheme.
 *
 * @param grade - The grade, or `null` when none was recorded.
 * @param policy - Supplies the letter order.
 * @returns A rank where higher is better, or `null` when the grade has no approved rank.
 */
function rankGrade(grade: Grade | null, policy: AcademicPolicy): number | null {
  if (grade?.scheme === GradeScheme.Letter) {
    return rankLetterGrade(grade.value, policy);
  }
  if (grade?.scheme === GradeScheme.PassFail) {
    return grade.value === PassFailGrade.Pass ? 1 : 0;
  }
  // SAFETY: missing, numeric, and unrecognized grades have no approved order (planning/08
  // §Candidate formation: preserve grade schemes).
  return null;
}

/**
 * Picks the single highest-ranked attempt.
 *
 * @param attempts - The candidate attempts.
 * @param rank - Gives each attempt's rank, higher is better, or `null` when unknown.
 * @returns The best attempt, or `null` when any rank is unknown or the best rank is tied.
 */
function pickUniqueBest(
  attempts: readonly CourseAttempt[],
  rank: (attempt: CourseAttempt) => number | null,
): CourseAttempt | null {
  let best: CourseAttempt | null = null;
  let bestRank = -1;
  let isTied = false;
  for (const attempt of attempts) {
    const attemptRank = rank(attempt);
    if (attemptRank === null) {
      return null;
    }
    if (attemptRank > bestRank) {
      best = attempt;
      bestRank = attemptRank;
      isTied = false;
    } else if (attemptRank === bestRank) {
      isTied = true;
    }
  }
  // SAFETY: a tie means the policy doesn't single out one attempt; picking by input order would
  // be a guess (planning/08 §Eligibility semantics).
  return isTied ? null : best;
}
