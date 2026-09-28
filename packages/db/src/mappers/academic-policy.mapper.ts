/**
 * @file Converts academic policy rows into domain objects.
 * @module @caa/db/mappers/academic-policy
 * @requirement FR-06
 * @requirement FR-09
 */
import {
  type AcademicPolicy,
  createAcademicPolicy,
  type TermCreditBounds,
  TermCreditBoundsSchema,
} from '@caa/domain';

import type { AcademicPolicyRow } from '../tables/academic-policy.table';

/**
 * Rebuilds the term credit bounds from their two columns.
 *
 * @param row - Row read from the `academic_policy` table.
 * @returns The bounds, or null when both columns are null.
 * @throws {z.ZodError} When only one bound is stored or the minimum exceeds the maximum.
 */
function toTermCreditBounds(row: AcademicPolicyRow): TermCreditBounds | null {
  // SAFETY: only both-null means "not supplied". One null side is parsed so it fails loudly
  // instead of becoming an unknown or a one-sided range.
  if (row.termMinCreditsHundredths === null && row.termMaxCreditsHundredths === null) {
    return null;
  }
  return TermCreditBoundsSchema.parse({
    minCreditsHundredths: row.termMinCreditsHundredths,
    maxCreditsHundredths: row.termMaxCreditsHundredths,
  });
}

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `academic_policy` table.
 * @returns The domain academic policy. Unknown settings stay null.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toAcademicPolicy(row: AcademicPolicyRow): AcademicPolicy {
  return createAcademicPolicy({
    tenantId: row.tenantId,
    rulesetVersion: row.rulesetVersion,
    allowsInProgressPrerequisites: row.allowsInProgressPrerequisites,
    passSatisfiesMinimumGrade: row.passSatisfiesMinimumGrade,
    letterGradeOrder: row.letterGradeOrder,
    lowestPassingLetterGrade: row.lowestPassingLetterGrade,
    repeatPolicy: row.repeatPolicy,
    termCreditBounds: toTermCreditBounds(row),
  });
}
