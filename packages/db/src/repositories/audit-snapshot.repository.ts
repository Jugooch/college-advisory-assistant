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
import { groupRequirementLinks } from '../mappers/requirement-result.mapper';
import { type AuditSnapshotRow, auditSnapshotTable } from '../tables/audit-snapshot.table';
import { requirementResultTable } from '../tables/requirement-result.table';
import { requirementResultAllocatedAttemptTable } from '../tables/requirement-result-allocated-attempt.table';
import { requirementResultCandidateCourseTable } from '../tables/requirement-result-candidate-course.table';
import { studentTable } from '../tables/student.table';

/**
 * Result of {@link AuditSnapshotRepository.findLatest}. `AMBIGUOUS` means two audits share the
 * newest generation time, so the source doesn't say which is newer.
 */
export type LatestAuditSnapshot =
  { readonly status: 'FOUND'; readonly audit: AuditSnapshot } | { readonly status: 'AMBIGUOUS' };

/** Reads audit snapshots. Imported, immutable revisions, so there are no update methods. */
export interface AuditSnapshotRepository {
  /**
   * Finds the student's latest audit: the one with the strictly newest `generatedAt`. Ingestion
   * time never decides. When two audits share the newest generation time the result is
   * `AMBIGUOUS`, never a pick. The audit keeps the `studentSnapshotId` it ran against, whatever
   * snapshots arrived later.
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
 * @returns `true` when both have the same generation time.
 */
function isTied(newest: AuditSnapshotRow, runnerUp: AuditSnapshotRow | undefined): boolean {
  // SAFETY: only the audit source orders audits (planning/07 §Consistency model: a recent import
  // timestamp must not hide an old source audit). Ingestion time is ignored, and no source
  // ordering field exists yet, so two audits generated at the same time conflict and the caller
  // reports UNKNOWN rather than trusting either allocation.
  return runnerUp?.generatedAt.getTime() === newest.generatedAt.getTime();
}

/**
 * Reads one audit's requirement rows and their allocation and candidate rows, each in position
 * order, and maps them with the audit row.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant that owns the audit.
 * @param audit - The audit row.
 * @returns The domain audit snapshot.
 * @throws {z.ZodError} When the stored audit or its requirement tree is invalid.
 */
async function loadAudit(
  db: Database,
  tenantId: InstitutionId,
  audit: AuditSnapshotRow,
): Promise<AuditSnapshot> {
  const requirements = requirementResultTable;
  const allocations = requirementResultAllocatedAttemptTable;
  const candidates = requirementResultCandidateCourseTable;
  // SECURITY: every read is filtered by tenant as well as by the audit.
  const [requirementRows, allocationRows, candidateRows] = await Promise.all([
    db
      .select()
      .from(requirements)
      .where(and(eq(requirements.tenantId, tenantId), eq(requirements.auditSnapshotId, audit.id)))
      .orderBy(asc(requirements.position)),
    db
      .select()
      .from(allocations)
      .where(and(eq(allocations.tenantId, tenantId), eq(allocations.auditSnapshotId, audit.id)))
      .orderBy(asc(allocations.requirementResultId), asc(allocations.position)),
    db
      .select()
      .from(candidates)
      .where(and(eq(candidates.tenantId, tenantId), eq(candidates.auditSnapshotId, audit.id)))
      .orderBy(asc(candidates.requirementResultId), asc(candidates.position)),
  ]);
  const links = groupRequirementLinks(allocationRows, candidateRows);
  return toAuditSnapshot(audit, requirementRows, links);
}

/**
 * Creates the audit snapshot repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link AuditSnapshotRepository}.
 */
export function createAuditSnapshotRepository(db: Database): AuditSnapshotRepository {
  const audits = auditSnapshotTable;
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
        .orderBy(desc(audits.generatedAt))
        .limit(2);
      if (!newest) {
        return null;
      }
      if (isTied(newest.audit, runnerUp?.audit)) {
        return { status: 'AMBIGUOUS' };
      }
      return { status: 'FOUND', audit: await loadAudit(db, tenantId, newest.audit) };
    },
  };
}
