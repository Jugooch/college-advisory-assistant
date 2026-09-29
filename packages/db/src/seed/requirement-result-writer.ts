/**
 * @file Writes an audit's requirement results with their allocated attempts and candidate
 *   courses. Insert-only and idempotent; shared by the seed and the integration fixtures.
 * @module @caa/db/seed/requirement-result-writer
 * @requirement FR-05
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { Database } from '../client';
import { requirementResultTable } from '../tables/requirement-result.table';
import { requirementResultAllocatedAttemptTable } from '../tables/requirement-result-allocated-attempt.table';
import { requirementResultCandidateCourseTable } from '../tables/requirement-result-candidate-course.table';

/** The part of a database handle or transaction the writer uses. */
export type RequirementResultWriter = Pick<Database, 'insert'>;

/** The audit the requirements belong to, and the student snapshot it is pinned to. */
export interface RequirementAuditScope {
  readonly tenantId: string;
  readonly auditSnapshotId: string;
  readonly studentSnapshotId: string;
}

type RequirementInsert = typeof requirementResultTable.$inferInsert;

/** One requirement to write: its columns plus its ordered ID lists. */
export type RequirementToWrite = Pick<
  RequirementInsert,
  | 'sourceRequirementId'
  | 'parentSourceRequirementId'
  | 'label'
  | 'state'
  | 'remainingCreditsHundredths'
  | 'remainingCourseCount'
  | 'isReusable'
  | 'sourceRef'
> & {
  readonly allocatedAttemptIds: readonly string[];
  readonly candidateCourseIds: readonly string[];
};

/**
 * Builds the allocation and candidate rows of the requirements this call inserted.
 *
 * @param scope - The audit and its pinned student snapshot.
 * @param requirements - The requirements, each with its new row ID.
 * @returns The link rows, each list in its requirement's order.
 */
function toLinkRows(
  scope: RequirementAuditScope,
  requirements: readonly (RequirementToWrite & { readonly id: string })[],
) {
  const { tenantId, auditSnapshotId, studentSnapshotId } = scope;
  return {
    allocations: requirements.flatMap((requirement) =>
      requirement.allocatedAttemptIds.map((courseAttemptId, position) => ({
        tenantId,
        auditSnapshotId,
        requirementResultId: requirement.id,
        studentSnapshotId,
        courseAttemptId,
        position,
      })),
    ),
    candidates: requirements.flatMap((requirement) =>
      requirement.candidateCourseIds.map((courseId, position) => ({
        tenantId,
        auditSnapshotId,
        requirementResultId: requirement.id,
        courseId,
        position,
      })),
    ),
  };
}

/**
 * Writes the requirements in audit order, then their allocation and candidate rows in list
 * order. A requirement that already exists is left as it is, links included, so a re-run writes
 * nothing new. Links of a newly written requirement are never skipped: a repeated attempt or
 * course fails the insert.
 *
 * @param tx - Open transaction; the caller commits the audit and its requirements together.
 * @param scope - The audit and its pinned student snapshot.
 * @param requirements - The audit's requirements, in audit order.
 * @throws {Error} When the database refuses a row: an allocated attempt outside the pinned
 *   snapshot, a candidate that isn't a course of the tenant, or a repeated attempt or course.
 */
export async function insertRequirementResults(
  tx: RequirementResultWriter,
  scope: RequirementAuditScope,
  requirements: readonly RequirementToWrite[],
): Promise<void> {
  const results = requirementResultTable;
  const inserted = await tx
    .insert(results)
    .values(
      requirements.map((requirement, position) => ({
        tenantId: scope.tenantId,
        auditSnapshotId: scope.auditSnapshotId,
        position,
        sourceRequirementId: requirement.sourceRequirementId,
        parentSourceRequirementId: requirement.parentSourceRequirementId,
        label: requirement.label,
        state: requirement.state,
        remainingCreditsHundredths: requirement.remainingCreditsHundredths,
        remainingCourseCount: requirement.remainingCourseCount,
        isReusable: requirement.isReusable,
        sourceRef: requirement.sourceRef,
      })),
    )
    .onConflictDoNothing({
      target: [results.tenantId, results.auditSnapshotId, results.sourceRequirementId],
    })
    .returning({ id: results.id, sourceRequirementId: results.sourceRequirementId });
  const newIds = new Map(inserted.map((row) => [row.sourceRequirementId, row.id]));
  const written = requirements.flatMap((requirement) => {
    const id = newIds.get(requirement.sourceRequirementId);
    return id === undefined ? [] : [{ ...requirement, id }];
  });
  const { allocations, candidates } = toLinkRows(scope, written);
  if (allocations.length > 0) {
    await tx.insert(requirementResultAllocatedAttemptTable).values(allocations);
  }
  if (candidates.length > 0) {
    await tx.insert(requirementResultCandidateCourseTable).values(candidates);
  }
}
