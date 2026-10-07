/**
 * @file Counts the credit-earning attempts of a course the institution states is repeatable for credit.
 * @module @caa/engine/verification/count-repeat-credit
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import {
  type AcademicPolicy,
  CheckState,
  CountingState,
  type Course,
  type CourseAttempt,
  type CourseId,
  type Grade,
  ReasonCode,
  type RepeatableForCredit,
} from '@caa/domain';

import { compareToMinimumGrade } from './compare-to-minimum-grade';
import type { AttemptResolutionContext, CountingResolution } from './select-counting-attempt';
import { termPositionOf } from './term-position';

/** The attempts of a repeatable group that count, earliest term first. */
export type CountedAttempts = readonly [CourseAttempt, ...CourseAttempt[]];

/**
 * The counted attempts of a repeatable-for-credit group. `earnedCreditsHundredths` is the sum
 * of their `creditsEarnedHundredths`, capped at `maxCreditsHundredths`; `null` is unknown.
 */
export interface RepeatCreditCounted {
  readonly state: typeof CountingState.Counted;
  readonly attempts: CountedAttempts;
  readonly earnedCreditsHundredths: number | null;
}

/** How a repeatable-for-credit group's attempts count. */
export type RepeatCreditResolution =
  | RepeatCreditCounted
  | Exclude<CountingResolution, { readonly state: typeof CountingState.Counted }>;

/** An attempt with its position in the term order, `null` when its term can't be placed. */
interface PlacedAttempt {
  readonly attempt: CourseAttempt;
  readonly position: number | null;
  /** `false` when the attempt may have earned nothing, so it may not use up a slot. */
  readonly isSettled: boolean;
}

/** A group's repeat-for-credit statement, with the catalog its attempts' courses come from. */
export interface RepeatCreditRules {
  readonly statement: RepeatableForCredit;
  /** The catalog by course ID, to tell a 0-credit course from a failed attempt. */
  readonly courseById: ReadonlyMap<CourseId, Course>;
}

const ORDER_UNDETERMINED: RepeatCreditResolution = {
  state: CountingState.Undetermined,
  reasonCode: ReasonCode.RepeatOrderUndetermined,
  earnedCreditsHundredths: null,
};

/**
 * Counts a repeatable-for-credit group's attempts (ADR-0012 §2). The repeat policy isn't
 * consulted, because these attempts don't replace one another.
 *
 * Attempts that earned nothing don't count and don't use up `maxAttempts` (see
 * `earnedSomething`). The earliest `maxAttempts` of the rest count, in term order, and their
 * earned credits are summed and capped at `maxCreditsHundredths`. Order matters only when the
 * attempt cap leaves some out.
 *
 * @param completed - The group's COMPLETED and TRANSFER_AWARDED attempts, in any order.
 * @param rules - The group's repeat-for-credit statement and caps, and the catalog.
 * @param context - The academic policy, for its tenant, and the tenant's term order.
 * @returns COUNTED with the counted attempts, NONE when no attempt earned anything, or
 *   UNDETERMINED (`REPEAT_ORDER_UNDETERMINED`) when the attempt cap's cut can't be placed.
 */
export function countRepeatCredit(
  completed: readonly CourseAttempt[],
  rules: RepeatCreditRules,
  context: AttemptResolutionContext,
): RepeatCreditResolution {
  const { statement, courseById } = rules;
  const { termCalendar, academicPolicy } = context;
  const ordered = completed
    .map((attempt) => ({
      attempt,
      earned: earnedSomething(attempt, courseById.get(attempt.courseId), academicPolicy),
    }))
    .filter(({ earned }) => earned !== false)
    .map(({ attempt, earned }) => ({
      attempt,
      position: termPositionOf(termCalendar, academicPolicy.tenantId, attempt.termCode),
      isSettled: earned === true,
    }))
    .sort(compareTermThenId);
  const cut =
    statement.maxAttempts === null
      ? ordered.length
      : Math.min(statement.maxAttempts, ordered.length);
  if (cut < ordered.length && !isCutSettled(ordered, cut)) {
    return ORDER_UNDETERMINED;
  }
  const [first, ...rest] = ordered.slice(0, cut).map((placed) => placed.attempt);
  if (first === undefined) {
    return { state: CountingState.None, earnedCreditsHundredths: 0 };
  }
  const attempts: CountedAttempts = [first, ...rest];
  return {
    state: CountingState.Counted,
    attempts,
    earnedCreditsHundredths: sumCapped(attempts, statement.maxCreditsHundredths),
  };
}

/**
 * Decides whether an attempt earned something, so it counts and uses up an attempt slot.
 *
 * @param attempt - A COMPLETED or TRANSFER_AWARDED attempt.
 * @param course - The attempt's catalog course, if known.
 * @param policy - The academic policy, for which grades are passing completions.
 * @returns `true` when it earned credit or passed a 0-credit course, `false` when it earned
 *   nothing, and `null` when that can't be told.
 */
function earnedSomething(
  attempt: CourseAttempt,
  course: Course | undefined,
  policy: AcademicPolicy,
): boolean | null {
  const earned = attempt.creditsEarnedHundredths;
  // SAFETY: an unknown award may have earned credit, so it is neither counted as nothing nor
  // as something (ADR-0012 §2: unknown credit).
  if (earned === null) {
    return null;
  }
  if (earned > 0) {
    return true;
  }
  // SAFETY: 0 earned from a course that awards credit means the attempt earned nothing, such as
  // a failed one, so it doesn't use up the attempt cap (ADR-0012 §2: which attempts count).
  const offered = course?.creditsHundredths ?? course?.minCreditsHundredths ?? 0;
  if (offered > 0) {
    return false;
  }
  // SAFETY: a 0-credit course, or a variable-credit course that can award 0, earns 0 even when
  // passed, so the grade decides: a passing completion counts and uses up a slot, a failing one
  // doesn't, and a grade with no settled meaning leaves it unknown (ADR-0012 §2: which attempts
  // count; planning/08 §Authority and result semantics: missing data is UNKNOWN).
  return attempt.grade === null ? null : isPassingCompletion(attempt.grade, policy);
}

/**
 * Decides whether a grade is a passing completion under the policy.
 *
 * @param grade - The recorded grade.
 * @param policy - The academic policy, for its passing cutoff and letter order.
 * @returns `true` when passing, `false` when failing, and `null` when the policy doesn't say.
 */
function isPassingCompletion(grade: Grade, policy: AcademicPolicy): boolean | null {
  const { state } = compareToMinimumGrade(grade, null, policy);
  if (state === CheckState.Pass || state === CheckState.Fail) {
    return state === CheckState.Pass;
  }
  return null;
}

/**
 * Orders attempts by term, then by `id`. Unplaced terms sort last. IDs are compared by UTF-16
 * code unit, so the order doesn't depend on input order or locale.
 *
 * @param left - One attempt.
 * @param right - Another attempt.
 * @returns A negative, zero, or positive sort result.
 */
function compareTermThenId(left: PlacedAttempt, right: PlacedAttempt): number {
  const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
  const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
  if (leftPosition !== rightPosition) {
    return leftPosition < rightPosition ? -1 : 1;
  }
  return Number(left.attempt.id > right.attempt.id) - Number(left.attempt.id < right.attempt.id);
}

/**
 * Decides whether the attempt cap's cut, between `ordered[cut - 1]` and `ordered[cut]`, is
 * settled whatever the true order of tied or unplaced attempts.
 *
 * @param ordered - The candidate attempts in term order, more of them than `cut`.
 * @param cut - How many attempts the cap lets count.
 * @returns `true` when the counted attempts and their outcome are settled.
 */
function isCutSettled(ordered: readonly PlacedAttempt[], cut: number): boolean {
  // SAFETY: a term missing from the calendar could fall anywhere in the order, and an attempt
  // that may have earned nothing could free a slot for a later attempt, so either leaves the
  // counted attempts unsettled (ADR-0012 §2: order only matters when a cap binds).
  if (ordered.some((placed) => placed.position === null)) {
    return false;
  }
  const counted = ordered.slice(0, cut);
  if (counted.some((placed) => !placed.isSettled)) {
    return false;
  }
  const lastPosition = counted.at(-1)?.position;
  const firstLeftOut = ordered[cut];
  if (firstLeftOut === undefined || firstLeftOut.position !== lastPosition) {
    return true;
  }
  // SAFETY: attempts in the same term have no approved order. A tie across the cut is broken
  // by `id` only when the tied attempts earned the same credits and grade, so the choice
  // changes the cited evidence but neither the total nor a minimum-grade check (ADR-0012 §2:
  // ties of equal credit; planning/08 §Candidate formation: preserve grade schemes).
  const [tied, ...others] = ordered.filter((placed) => placed.position === lastPosition);
  return tied !== undefined && others.every((other) => hasSameAward(tied.attempt, other.attempt));
}

/**
 * Decides whether two attempts earned the same credits and grade.
 *
 * @param left - One attempt.
 * @param right - Another attempt.
 * @returns `true` when the earned credits and the grade's scheme and value all match.
 */
function hasSameAward(left: CourseAttempt, right: CourseAttempt): boolean {
  return (
    left.creditsEarnedHundredths === right.creditsEarnedHundredths &&
    left.grade?.scheme === right.grade?.scheme &&
    left.grade?.value === right.grade?.value
  );
}

/**
 * Sums the counted attempts' earned credits and applies the credit cap.
 *
 * @param attempts - The counted attempts.
 * @param maxCreditsHundredths - The credit cap, or `null` when none is stated.
 * @returns The capped sum, or `null` when any counted attempt's award is unknown.
 */
function sumCapped(attempts: CountedAttempts, maxCreditsHundredths: number | null): number | null {
  let total = 0;
  for (const { creditsEarnedHundredths } of attempts) {
    // SAFETY: credits come only from recorded awards; one unknown award makes the total
    // unknown, never a guess (ADR-0012 §2: unknown credit).
    if (creditsEarnedHundredths === null) {
      return null;
    }
    total += creditsEarnedHundredths;
  }
  return maxCreditsHundredths === null ? total : Math.min(total, maxCreditsHundredths);
}
