/**
 * @file Counts the credit-earning attempts of a course the institution states is repeatable for credit.
 * @module @caa/engine/verification/count-repeat-credit
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import {
  CountingState,
  type CourseAttempt,
  ReasonCode,
  type RepeatableForCredit,
} from '@caa/domain';

import type { AttemptResolutionContext, CountingResolution } from './select-counting-attempt';
import { termPositionOf } from './term-position';

/** The attempts of a repeatable group that earn credit, earliest term first. */
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
 * Attempts that earned 0 credits don't count and don't use up `maxAttempts`. The earliest
 * `maxAttempts` of the rest count, in term order, and their earned credits are summed and
 * capped at `maxCreditsHundredths`. Order matters only when the attempt cap leaves some out.
 *
 * @param completed - The group's COMPLETED and TRANSFER_AWARDED attempts, in any order.
 * @param statement - The group's repeat-for-credit statement and caps.
 * @param context - The academic policy, for its tenant, and the tenant's term order.
 * @returns COUNTED with the counted attempts, NONE when no attempt earned credit, or
 *   UNDETERMINED (`REPEAT_ORDER_UNDETERMINED`) when the attempt cap's cut can't be placed.
 */
export function countRepeatCredit(
  completed: readonly CourseAttempt[],
  statement: RepeatableForCredit,
  context: AttemptResolutionContext,
): RepeatCreditResolution {
  const { termCalendar } = context;
  const { tenantId } = context.academicPolicy;
  // SAFETY: an attempt that earned 0 credits, such as a failed one, adds nothing and doesn't
  // use up the attempt cap (ADR-0012 §2: which attempts count). An unknown award (`null`) may
  // have earned credit, so it stays a candidate.
  const ordered = completed
    .filter((attempt) => attempt.creditsEarnedHundredths !== 0)
    .map((attempt) => ({
      attempt,
      position: termPositionOf(termCalendar, tenantId, attempt.termCode),
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
  // SAFETY: a term missing from the calendar could fall anywhere in the order, and an unknown
  // award could be 0 and free a slot for a later attempt, so either leaves the counted
  // attempts unsettled (ADR-0012 §2: order only matters when a cap binds).
  if (ordered.some((placed) => placed.position === null)) {
    return false;
  }
  const counted = ordered.slice(0, cut);
  if (counted.some((placed) => placed.attempt.creditsEarnedHundredths === null)) {
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
