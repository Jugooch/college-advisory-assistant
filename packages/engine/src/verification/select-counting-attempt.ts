/**
 * @file Chooses which completed or awarded attempt counts when a course has been repeated.
 * @module @caa/engine/verification/select-counting-attempt
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AcademicPolicy,
  type CourseAttempt,
  type Grade,
  GradeScheme,
  PassFailGrade,
} from '@caa/domain';

/** Institution rule for which of several completed attempts of a course counts. */
export const RepeatPolicy = {
  /** The attempt in the latest term counts, whatever its grade. */
  MostRecent: 'MOST_RECENT',
  /** The attempt with the highest grade counts. */
  HighestGrade: 'HIGHEST_GRADE',
} as const;

/** Union of every {@link RepeatPolicy} value. */
export type RepeatPolicy = (typeof RepeatPolicy)[keyof typeof RepeatPolicy];

/** A repeat policy together with the institution data it needs. Never defaulted by the engine. */
export type RepeatRule =
  | {
      readonly repeatPolicy: typeof RepeatPolicy.MostRecent;
      /** The tenant's term codes, oldest first. Term codes don't sort lexically across tenants. */
      readonly termCodesOldestFirst: readonly string[];
    }
  | {
      readonly repeatPolicy: typeof RepeatPolicy.HighestGrade;
      /** Supplies the letter order used to rank grades. */
      readonly academicPolicy: AcademicPolicy;
    };

/** Whether a group has a counting attempt. */
export const CountingState = {
  /** Exactly one attempt counts. */
  Counted: 'COUNTED',
  /** No completed or awarded attempt exists, so nothing counts and no credit is earned. */
  None: 'NONE',
  /** Attempts exist but the engine can't tell which counts; treat as UNKNOWN. */
  Undetermined: 'UNDETERMINED',
} as const;

/** Union of every {@link CountingState} value. */
export type CountingState = (typeof CountingState)[keyof typeof CountingState];

/** Why the counting attempt of a group is undetermined. */
export const AttemptResolutionIssue = {
  /** Several attempts completed and no repeat policy was supplied. */
  RepeatPolicyUndefined: 'REPEAT_POLICY_UNDEFINED',
  /** The repeat policy can't rank the attempts: unknown term or grade, or a tie. */
  RepeatOrderUndetermined: 'REPEAT_ORDER_UNDETERMINED',
  /** An attempt's course isn't in the supplied catalog, so its equivalents are unknown. */
  CourseNotInCatalog: 'COURSE_NOT_IN_CATALOG',
} as const;

/** Union of every {@link AttemptResolutionIssue} value. */
export type AttemptResolutionIssue =
  (typeof AttemptResolutionIssue)[keyof typeof AttemptResolutionIssue];

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
      readonly issue: AttemptResolutionIssue;
      readonly earnedCreditsHundredths: null;
    };

/**
 * Chooses the one attempt that counts among a group's completed or awarded attempts.
 *
 * @param completed - The group's COMPLETED and TRANSFER_AWARDED attempts.
 * @param rule - The institution's repeat rule, or `undefined` when it hasn't been supplied.
 * @returns The counting attempt, NONE when there is no candidate, or UNDETERMINED with an issue.
 */
export function selectCountingAttempt(
  completed: readonly CourseAttempt[],
  rule: RepeatRule | undefined,
): CountingResolution {
  const [first, ...rest] = completed;
  if (first === undefined) {
    return { state: CountingState.None, earnedCreditsHundredths: 0 };
  }
  if (rest.length === 0) {
    return counted(first);
  }
  // SAFETY: which repeat counts is institution policy. Without it the engine doesn't pick one,
  // so the group is UNKNOWN (planning/08 §Eligibility semantics: repeated attempts use approved
  // source semantics).
  if (rule === undefined) {
    return undetermined(AttemptResolutionIssue.RepeatPolicyUndefined);
  }
  const rank =
    rule.repeatPolicy === RepeatPolicy.MostRecent
      ? (attempt: CourseAttempt): number | null => rankByTerm(attempt, rule.termCodesOldestFirst)
      : gradeRanker(completed, rule.academicPolicy);
  const best = pickUniqueBest(completed, rank);
  return best === null
    ? undetermined(AttemptResolutionIssue.RepeatOrderUndetermined)
    : counted(best);
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
 * Builds an UNDETERMINED resolution.
 *
 * @param issue - Why no attempt could be chosen.
 * @returns The resolution, with unknown earned credits.
 */
function undetermined(issue: AttemptResolutionIssue): CountingResolution {
  return { state: CountingState.Undetermined, issue, earnedCreditsHundredths: null };
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
  const schemes = new Set(attempts.map((attempt) => attempt.grade?.scheme));
  // SAFETY: grades under different schemes, such as `P` and `B`, have no approved common scale
  // (planning/08 §Candidate formation: preserve grade schemes).
  if (schemes.size !== 1) {
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
    const index = policy.letterGradeOrder.indexOf(grade.value);
    // SAFETY: a letter missing from the institution's order has no rank (planning/08).
    return index === -1 ? null : policy.letterGradeOrder.length - index;
  }
  if (grade?.scheme === GradeScheme.PassFail) {
    return grade.value === PassFailGrade.Pass ? 1 : 0;
  }
  // SAFETY: missing, numeric, and unrecognized grades have no approved order.
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
  // be a guess.
  return isTied ? null : best;
}
