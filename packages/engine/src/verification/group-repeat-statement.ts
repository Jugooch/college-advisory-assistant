/**
 * @file Finds the repeat-for-credit statement shared by every catalog course of an attempt group.
 * @module @caa/engine/verification/group-repeat-statement
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import type { Course, RepeatableForCredit } from '@caa/domain';

/**
 * A group's repeat-for-credit statement (`null` when its courses state none), or a conflict
 * when its courses state different values.
 */
export type GroupRepeatStatement =
  | { readonly isConflict: false; readonly statement: RepeatableForCredit | null }
  | { readonly isConflict: true };

/**
 * Finds the statement every course of a group shares.
 *
 * @param groupCourses - Every catalog course of the group, including courses never attempted.
 * @returns The shared statement, `null` when every course states none (or there are no
 *   courses), or a conflict.
 */
export function groupRepeatStatement(groupCourses: readonly Course[]): GroupRepeatStatement {
  const [first, ...rest] = groupCourses.map((course) => course.repeatableForCredit);
  if (first === undefined) {
    return { isConflict: false, statement: null };
  }
  // SAFETY: a group is repeatable only when every course in it, attempted or not, states the
  // same statement. A catalog that disagrees with itself is never resolved by picking one
  // (ADR-0012 §2: when it applies; AC04).
  return rest.every((statement) => isSameStatement(first, statement))
    ? { isConflict: false, statement: first }
    : { isConflict: true };
}

/**
 * Compares two statements by value.
 *
 * @param left - One statement, or `null`.
 * @param right - Another statement, or `null`.
 * @returns `true` when both are `null`, or both state the same caps.
 */
function isSameStatement(
  left: RepeatableForCredit | null,
  right: RepeatableForCredit | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.maxAttempts === right.maxAttempts &&
    left.maxCreditsHundredths === right.maxCreditsHundredths
  );
}
