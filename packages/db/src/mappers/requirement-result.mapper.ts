/**
 * @file Converts requirement result rows and their link rows into domain objects.
 * @module @caa/db/mappers/requirement-result
 * @requirement FR-05
 */
import { createRequirementResult, type RequirementResult } from '@caa/domain';

import type { RequirementResultRow } from '../tables/requirement-result.table';
import type { RequirementResultAllocatedAttemptRow } from '../tables/requirement-result-allocated-attempt.table';
import type { RequirementResultCandidateCourseRow } from '../tables/requirement-result-candidate-course.table';

/**
 * A requirement's link rows, each list already in position order: the attempts the audit
 * allocated to it and the courses it lists as candidates.
 */
export interface RequirementResultLinks {
  readonly allocatedAttemptIds: readonly string[];
  readonly candidateCourseIds: readonly string[];
}

/** Links of a requirement that has no allocation or candidate rows. */
export const NO_REQUIREMENT_LINKS: RequirementResultLinks = {
  allocatedAttemptIds: [],
  candidateCourseIds: [],
};

/** An allocation row, reduced to the columns the grouping reads. */
type AllocationLinkRow = Pick<
  RequirementResultAllocatedAttemptRow,
  'requirementResultId' | 'courseAttemptId'
>;

/** A candidate row, reduced to the columns the grouping reads. */
type CandidateLinkRow = Pick<
  RequirementResultCandidateCourseRow,
  'requirementResultId' | 'courseId'
>;

/** Links being collected for one requirement. */
interface GroupedLinks {
  readonly allocatedAttemptIds: string[];
  readonly candidateCourseIds: string[];
}

/**
 * Groups an audit's link rows by requirement. Each list keeps the order of the rows it is given,
 * so callers pass them sorted by position.
 *
 * @param allocations - Allocation rows of one audit, in position order.
 * @param candidates - Candidate rows of one audit, in position order.
 * @returns The links of every requirement that has at least one row, keyed by its row `id`.
 */
export function groupRequirementLinks(
  allocations: readonly AllocationLinkRow[],
  candidates: readonly CandidateLinkRow[],
): ReadonlyMap<string, RequirementResultLinks> {
  const grouped = new Map<string, GroupedLinks>();
  const linksOf = (requirementResultId: string): GroupedLinks => {
    const existing = grouped.get(requirementResultId);
    if (existing) {
      return existing;
    }
    const created: GroupedLinks = { allocatedAttemptIds: [], candidateCourseIds: [] };
    grouped.set(requirementResultId, created);
    return created;
  };
  for (const row of allocations) {
    linksOf(row.requirementResultId).allocatedAttemptIds.push(row.courseAttemptId);
  }
  for (const row of candidates) {
    linksOf(row.requirementResultId).candidateCourseIds.push(row.courseId);
  }
  return grouped;
}

/**
 * Maps a database row and its link rows to a validated domain object. Tree checks (known
 * parents, no cycles) need the whole audit, so they run in the audit snapshot mapper.
 *
 * @param row - Row read from the `requirement_result` table.
 * @param links - Its allocated attempt and candidate course IDs, in position order.
 * @returns The domain requirement result.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toRequirementResult(
  row: RequirementResultRow,
  links: RequirementResultLinks,
): RequirementResult {
  return createRequirementResult({
    sourceRequirementId: row.sourceRequirementId,
    parentSourceRequirementId: row.parentSourceRequirementId,
    label: row.label,
    state: row.state,
    allocatedAttemptIds: [...links.allocatedAttemptIds],
    remainingCreditsHundredths: row.remainingCreditsHundredths,
    remainingCourseCount: row.remainingCourseCount,
    candidateCourseIds: [...links.candidateCourseIds],
    isReusable: row.isReusable,
    sourceRef: row.sourceRef,
  });
}
