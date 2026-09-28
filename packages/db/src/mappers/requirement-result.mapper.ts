/**
 * @file Converts requirement result rows into domain objects.
 * @module @caa/db/mappers/requirement-result
 * @requirement FR-05
 */
import { createRequirementResult, type RequirementResult } from '@caa/domain';

import type { RequirementResultRow } from '../tables/requirement-result.table';

/**
 * Maps a database row to a validated domain object. Tree checks (known parents, no cycles)
 * need the whole audit, so they run in the audit snapshot mapper.
 *
 * @param row - Row read from the `requirement_result` table.
 * @returns The domain requirement result.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toRequirementResult(row: RequirementResultRow): RequirementResult {
  return createRequirementResult({
    sourceRequirementId: row.sourceRequirementId,
    parentSourceRequirementId: row.parentSourceRequirementId,
    label: row.label,
    state: row.state,
    allocatedAttemptIds: row.allocatedAttemptIds,
    remainingCreditsHundredths: row.remainingCreditsHundredths,
    remainingCourseCount: row.remainingCourseCount,
    candidateCourseIds: row.candidateCourseIds,
    isReusable: row.isReusable,
    sourceRef: row.sourceRef,
  });
}
