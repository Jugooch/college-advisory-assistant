/**
 * @file Institution rule for which repeated attempt of a course counts.
 * @module @caa/domain/enums/repeat-policy
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Which of several completed attempts of one course counts. This is institution
 * configuration, never a default built into code.
 *
 * - `MOST_RECENT`: the attempt in the latest term counts, whatever its grade.
 * - `HIGHEST_GRADE`: the attempt with the highest grade counts.
 */
export const RepeatPolicy = {
  MostRecent: 'MOST_RECENT',
  HighestGrade: 'HIGHEST_GRADE',
} as const;

/** Union of every {@link RepeatPolicy} value. */
export type RepeatPolicy = (typeof RepeatPolicy)[keyof typeof RepeatPolicy];

/** Runtime schema for {@link RepeatPolicy}. */
export const RepeatPolicySchema = z.enum(RepeatPolicy);
