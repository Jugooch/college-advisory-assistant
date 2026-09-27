/**
 * @file Ranks a letter grade by the institution's letter order, the engine's only letter scale.
 * @module @caa/engine/verification/rank-letter-grade
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { AcademicPolicy, LetterGrade } from '@caa/domain';

/**
 * Ranks a letter grade by `policy.letterGradeOrder`, where a higher rank is a better grade.
 *
 * @param letter - The letter to rank.
 * @param policy - Supplies the institution's letter order, highest first.
 * @returns A positive rank (the highest letter ranks `letterGradeOrder.length`), or `null` when
 *   the letter is missing from the order.
 */
export function rankLetterGrade(letter: LetterGrade, policy: AcademicPolicy): number | null {
  const index = policy.letterGradeOrder.indexOf(letter);
  // SAFETY: a letter the institution didn't rank has no known position, so it gets no rank
  // rather than one guessed from a conventional scale (planning/08 §Eligibility semantics).
  return index === -1 ? null : policy.letterGradeOrder.length - index;
}
