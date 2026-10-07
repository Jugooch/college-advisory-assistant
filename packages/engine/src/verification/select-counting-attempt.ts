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
  type TermCalendar,
} from '@caa/domain';

import { rankLetterGrade } from './rank-letter-grade';
import { termPositionOf } from './term-position';

/** Institution inputs needed to decide which attempt of a repeated course counts. */
export interface AttemptResolutionContext {
  /** Supplies `repeatPolicy` (`null` = undetermined) and the letter order for HIGHEST_GRADE. */
  readonly academicPolicy: AcademicPolicy;
  /**
   * The tenant's term calendar, used by MOST_RECENT. Term codes are never compared as strings:
   * terms are ordered by `sequence` (see `termPositionOf`).
   */
  readonly termCalendar: TermCalendar;
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
 * A HIGHEST_GRADE tie is settled only when every tied attempt has the same course, status,
 * grade, and earned credits; the tied attempt with the lowest `id` then counts. Any other tie is
 * UNDETERMINED (`REPEAT_ORDER_UNDETERMINED`).
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
      ? (attempt: CourseAttempt): number | null =>
          termPositionOf(context.termCalendar, context.academicPolicy.tenantId, attempt.termCode)
      : gradeRanker(completed, context.academicPolicy);
  const best = findBestAttempts(completed, rank);
  const chosen = best === null ? null : breakTie(best, repeatPolicy);
  return chosen === null
    ? undeterminedCounting(ReasonCode.RepeatOrderUndetermined)
    : counted(chosen);
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

/** The attempts that share the best rank, in input order. */
type BestAttempts = readonly [CourseAttempt, ...CourseAttempt[]];

/**
 * Finds every attempt that shares the highest rank.
 *
 * @param attempts - The candidate attempts.
 * @param rank - Gives each attempt's rank, higher is better, or `null` when unknown.
 * @returns The best-ranked attempts in input order, or `null` when any rank is unknown or there
 *   are no attempts.
 */
function findBestAttempts(
  attempts: readonly CourseAttempt[],
  rank: (attempt: CourseAttempt) => number | null,
): BestAttempts | null {
  let best: [CourseAttempt, ...CourseAttempt[]] | null = null;
  let bestRank = Number.NEGATIVE_INFINITY;
  for (const attempt of attempts) {
    const attemptRank = rank(attempt);
    if (attemptRank === null) {
      return null;
    }
    if (best === null || attemptRank > bestRank) {
      best = [attempt];
      bestRank = attemptRank;
    } else if (attemptRank === bestRank) {
      best.push(attempt);
    }
  }
  return best;
}

/**
 * Settles which of the best-ranked attempts counts.
 *
 * @param best - The attempts that share the best rank.
 * @param repeatPolicy - The repeat policy that ranked them.
 * @returns The only best attempt; under HIGHEST_GRADE, the tied attempt with the lowest `id` when
 *   every tied attempt has an identical outcome; otherwise `null`.
 */
function breakTie(best: BestAttempts, repeatPolicy: RepeatPolicy): CourseAttempt | null {
  const [first, ...rest] = best;
  if (rest.length === 0) {
    return first;
  }
  // SAFETY: a tie means the policy doesn't single out one attempt; picking by input order would
  // be a guess (planning/08 §Eligibility semantics: repeated attempts use approved source
  // semantics). Under HIGHEST_GRADE the engine still settles a tie when every tied attempt would
  // give the same counted outcome, because then which one counts can't change any answer
  // (issue #78). A MOST_RECENT tie is two attempts in one term, which the policy can't order, so
  // it stays undetermined.
  if (
    repeatPolicy !== RepeatPolicy.HighestGrade ||
    !rest.every((attempt) => hasIdenticalOutcome(first, attempt))
  ) {
    return null;
  }
  // NOTE: the lowest `id` by UTF-16 code unit is a stable choice independent of input order.
  // The outcome is identical whichever attempt is chosen; only the attempt cited as evidence
  // differs.
  return rest.reduce((lowest, attempt) => (attempt.id < lowest.id ? attempt : lowest), first);
}

/**
 * Decides whether two tied attempts give the same counted outcome.
 *
 * @param left - One tied attempt.
 * @param right - Another tied attempt.
 * @returns `true` when the course, status, grade (scheme and value), and earned credits all match.
 */
function hasIdenticalOutcome(left: CourseAttempt, right: CourseAttempt): boolean {
  // SAFETY: the grade decides minimum-grade checks and the earned credits decide credit totals,
  // so either differing changes the outcome (planning/08 §Candidate formation: authoritative
  // credit-award rules; preserve grade schemes). The course and status are compared too: an
  // equivalent course or a transfer award is different evidence of the credit, and the engine
  // doesn't decide that such a difference is immaterial. The term isn't compared, because
  // HIGHEST_GRADE doesn't use it.
  return (
    left.courseId === right.courseId &&
    left.status === right.status &&
    left.grade?.scheme === right.grade?.scheme &&
    left.grade?.value === right.grade?.value &&
    left.creditsEarnedHundredths === right.creditsEarnedHundredths
  );
}
