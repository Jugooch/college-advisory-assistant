/**
 * @file Converts audit snapshot rows and their requirement rows into domain objects.
 * @module @caa/db/mappers/audit-snapshot
 * @requirement FR-05
 * @requirement NFR-01
 */
import { type AuditSnapshot, createAuditSnapshot } from '@caa/domain';

import type { AuditSnapshotRow } from '../tables/audit-snapshot.table';
import type { RequirementResultRow } from '../tables/requirement-result.table';
import { toRequirementResult } from './requirement-result.mapper';

/**
 * Maps an audit row and its requirement rows to a validated domain object. The ingestion time
 * stays in the database.
 *
 * @param row - Row read from the `audit_snapshot` table.
 * @param requirementRows - Its `requirement_result` rows, in position order.
 * @returns The domain audit snapshot, with timestamps as ISO strings.
 * @throws {z.ZodError} When the stored audit violates the domain schema, including an empty
 *   requirement list, a repeated requirement ID, or a dangling, self, or cyclic parent.
 */
export function toAuditSnapshot(
  row: AuditSnapshotRow,
  requirementRows: readonly RequirementResultRow[],
): AuditSnapshot {
  return createAuditSnapshot({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    studentSnapshotId: row.studentSnapshotId,
    programId: row.programId,
    auditSource: row.auditSource,
    auditVersion: row.auditVersion,
    catalogYear: row.catalogYear,
    generatedAt: row.generatedAt.toISOString(),
    studentRecordEffectiveAt: row.studentRecordEffectiveAt.toISOString(),
    requirements: requirementRows.map(toRequirementResult),
  });
}
