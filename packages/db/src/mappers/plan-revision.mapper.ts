/**
 * @file Converts plan revision rows into domain objects.
 * @module @caa/db/mappers/plan-revision
 * @requirement FR-11
 * @requirement NFR-01
 */
import { type PlanRevision, PlanRevisionSchema } from '@caa/domain';

import type { PlanRevisionRow } from '../tables/plan-revision.table';

/**
 * A stored revision with its schedule-options result. The result is opaque here: the api
 * parses it with the contract schema on read (ADR-0013 §2), so this package never imports it.
 */
export interface StoredPlanRevision {
  readonly revision: PlanRevision;
  readonly result: unknown;
}

/**
 * Maps a database row to a validated domain revision, keeping the result as opaque JSON.
 *
 * @param row - Row read from the `plan_revision` table.
 * @returns The domain revision with timestamps as ISO strings, and the untouched result.
 * @throws {z.ZodError} When the stored row violates the domain schema, including an unparseable
 *   constraint set or credit selection.
 */
export function toStoredPlanRevision(row: PlanRevisionRow): StoredPlanRevision {
  // NOTE: parsed with the schema rather than `createPlanRevision`, because the stored JSONB
  // inputs are `unknown` until this parse validates them (docs/standards/04 rule 3).
  const revision = PlanRevisionSchema.parse({
    id: row.id,
    planId: row.planId,
    revision: row.revision,
    cause: row.cause,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    termId: row.termId,
    courseIds: row.courseIds,
    creditSelections: row.creditSelections,
    constraints: row.constraints,
    studentSnapshotId: row.studentSnapshotId,
    studentRecordEffectiveAt: row.studentRecordEffectiveAt.toISOString(),
    auditRecordEffectiveAt: row.auditRecordEffectiveAt.toISOString(),
    auditSnapshotId: row.auditSnapshotId,
    auditSource: row.auditSource,
    auditVersion: row.auditVersion,
    rulesetVersion: row.rulesetVersion,
    sectionSnapshotId: row.sectionSnapshotId,
    campusTransitionVersion: row.campusTransitionVersion,
    solverWorkCap: row.solverWorkCap,
    constraintHash: row.constraintHash,
    outcome: row.outcome,
    selectedSectionIds: row.selectedSectionIds,
  });
  return { revision, result: row.result };
}
