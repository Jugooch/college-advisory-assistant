/**
 * @file Read-only data access for audit snapshots and their requirement results.
 * @module @caa/db/repositories/audit-snapshot
 * @requirement FR-05
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { and, asc, desc, eq } from 'drizzle-orm';

import type { AuditSnapshot, InstitutionId, StudentId } from '@caa/domain';

import type { Database } from '../client';
import { toAuditSnapshot } from '../mappers/audit-snapshot.mapper';
import { type AuditSnapshotRow, auditSnapshotTable } from '../tables/audit-snapshot.table';
import { requirementResultTable } from '../tables/requirement-result.table';
import { studentTable } from '../tables/student.table';

/**
 * Result of {@link AuditSnapshotRepository.findLatest}. `AMBIGUOUS` means two audits share the
 * newest generation time and ingestion time, so neither is newer.
 */
export type LatestAuditSnapshot =
  { readonly status: 'FOUND'; readonly audit: AuditSnapshot } | { readonly status: 'AMBIGUOUS' };

/** Reads audit snapshots. Imported, immutable revisions, so there are no update methods. */
export interface AuditSnapshotRepository {
  /**
   * Finds the student's latest audit: the newest `generatedAt`, never the newest ingestion
   * alone. At an equal generation time the later ingestion wins; when both times are equal the
   * result is `AMBIGUOUS`, never an arbitrary pick. The audit keeps the `studentSnapshotId` it
   * ran against, whatever snapshots arrived later.
   *
   * @param tenantId - Tenant that owns the student.
   * @param studentId - Student whose audit is wanted.
   * @returns The latest audit with its requirements, or the ambiguity, or null when the
   *   student has no audit, belongs to another tenant, or was deleted by the source.
   * @throws {z.ZodError} When the stored audit or its requirement tree is invalid.
   */
  findLatest(tenantId: InstitutionId, studentId: StudentId): Promise<LatestAuditSnapshot | null>;
}

/**
 * Returns whether two audits are tied for newest, so neither is later.
 *
 * @param newest - The first row in "latest" order.
 * @param runnerUp - The second row, if any.
 * @returns `true` when both generation and ingestion times are equal.
 */
function isTied(newest: AuditSnapshotRow, runnerUp: AuditSnapshotRow | undefined): boolean {
  return (
    runnerUp?.generatedAt.getTime() === newest.generatedAt.getTime() &&
    runnerUp.ingestedAt.getTime() === newest.ingestedAt.getTime()
  );
}

/**
 * Creates the audit snapshot repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link AuditSnapshotRepository}.
 */
export function createAuditSnapshotRepository(db: Database): AuditSnapshotRepository {
  const audits = auditSnapshotTable;
  const requirements = requirementResultTable;
  return {
    async findLatest(tenantId, studentId) {
      const [newest, runnerUp] = await db
        .select({ audit: audits })
        .from(audits)
        .innerJoin(
          studentTable,
          and(eq(studentTable.tenantId, audits.tenantId), eq(studentTable.id, audits.studentId)),
        )
        .where(
          and(
            // SECURITY: every read is filtered by tenant; a tombstoned student is invisible.
            eq(audits.tenantId, tenantId),
            eq(audits.studentId, studentId),
            eq(studentTable.isDeleted, false),
          ),
        )
        .orderBy(desc(audits.generatedAt), desc(audits.ingestedAt))
        .limit(2);
      if (!newest) {
        return null;
      }
      // SAFETY: two audits at the same generation and ingestion time give no order, so the
      // caller gets the ambiguity instead of whichever row PostgreSQL returned first.
      if (isTied(newest.audit, runnerUp?.audit)) {
        return { status: 'AMBIGUOUS' };
      }
      const requirementRows = await db
        .select()
        .from(requirements)
        .where(
          and(
            eq(requirements.tenantId, tenantId),
            eq(requirements.auditSnapshotId, newest.audit.id),
          ),
        )
        .orderBy(asc(requirements.position));
      return { status: 'FOUND', audit: toAuditSnapshot(newest.audit, requirementRows) };
    },
  };
}
