/**
 * @file Synthetic snapshot, attempt, and audit rows for repository integration tests. Test code only.
 * @module @caa/db/testing/snapshot-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  AttemptStatus,
  type AuditSnapshotId,
  AuditSnapshotIdSchema,
  type CourseAttemptId,
  CourseAttemptIdSchema,
  type InstitutionId,
  RequirementState,
  type StudentId,
  type StudentSnapshotId,
  StudentSnapshotIdSchema,
} from '@caa/domain';

import type { Database } from '../client';
import {
  insertRequirementResults,
  type RequirementToWrite,
} from '../seed/requirement-result-writer';
import { auditSnapshotTable } from '../tables/audit-snapshot.table';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';

/** Synthetic program ID; programs aren't persisted yet. */
export const TEST_PROGRAM_ID = '1f2e3d4c-5b6a-4978-8a1b-2c3d4e5f6a7b';

type AttemptInsert = typeof courseAttemptTable.$inferInsert;

/** Attempt columns a test sets; the rest default to an in-progress `2026FA` attempt. */
export type AttemptFixture = Pick<AttemptInsert, 'studentId' | 'courseId'> &
  Partial<Omit<AttemptInsert, 'tenantId' | 'studentId' | 'courseId'>>;

/** Snapshot fields a test sets. Times are ISO strings; ingestion defaults to a later time. */
export interface SnapshotFixture {
  readonly studentId: StudentId;
  readonly sourceEffectiveAt: string;
  readonly ingestedAt?: string;
  readonly attemptIds?: readonly CourseAttemptId[];
}

/**
 * Requirement fields a test sets; the rest default to an incomplete top-level requirement with
 * no allocated attempts or candidates.
 */
export type RequirementFixture = Pick<RequirementToWrite, 'sourceRequirementId'> &
  Partial<RequirementToWrite>;

/** Audit fields a test sets. Times are ISO strings. */
export interface AuditFixture {
  readonly studentId: StudentId;
  readonly studentSnapshotId: StudentSnapshotId;
  readonly generatedAt: string;
  readonly ingestedAt?: string;
  readonly auditVersion?: string;
  readonly requirements: readonly RequirementFixture[];
}

/** Ingestion time used when a fixture doesn't set one; later than every source time used. */
const DEFAULT_INGESTED_AT = '2026-09-30T00:00:00.000Z';

/**
 * Inserts a synthetic course attempt.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param fixture - Student, course, and columns to change.
 * @returns The new attempt ID.
 */
export async function insertAttempt(
  db: Database,
  tenantId: InstitutionId,
  fixture: AttemptFixture,
): Promise<CourseAttemptId> {
  const rows = await db
    .insert(courseAttemptTable)
    .values({
      tenantId,
      sourceAttemptId: 'SYN-ATT-0001',
      termCode: '2026FA',
      status: AttemptStatus.InProgress,
      ...fixture,
    })
    .returning({ id: courseAttemptTable.id });
  return CourseAttemptIdSchema.parse(rows[0]?.id);
}

/**
 * Inserts a synthetic student snapshot and its attempt links in one transaction.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param fixture - Student, times, and attempts in order.
 * @returns The new snapshot ID.
 */
export async function insertSnapshot(
  db: Database,
  tenantId: InstitutionId,
  fixture: SnapshotFixture,
): Promise<StudentSnapshotId> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(studentSnapshotTable)
      .values({
        tenantId,
        studentId: fixture.studentId,
        programId: TEST_PROGRAM_ID,
        catalogYear: '2025-2026',
        sourceEffectiveAt: new Date(fixture.sourceEffectiveAt),
        ingestedAt: new Date(fixture.ingestedAt ?? DEFAULT_INGESTED_AT),
      })
      .returning({ id: studentSnapshotTable.id });
    const id = StudentSnapshotIdSchema.parse(rows[0]?.id);
    const attemptIds = fixture.attemptIds ?? [];
    if (attemptIds.length > 0) {
      await tx.insert(studentSnapshotAttemptTable).values(
        attemptIds.map((courseAttemptId, position) => ({
          tenantId,
          studentId: fixture.studentId,
          studentSnapshotId: id,
          courseAttemptId,
          position,
        })),
      );
    }
    return id;
  });
}

/**
 * Inserts a synthetic audit snapshot and its requirements in one transaction.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param fixture - Student, pinned snapshot, times, and requirements in order.
 * @returns The new audit ID.
 */
export async function insertAudit(
  db: Database,
  tenantId: InstitutionId,
  fixture: AuditFixture,
): Promise<AuditSnapshotId> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(auditSnapshotTable)
      .values({
        tenantId,
        studentId: fixture.studentId,
        studentSnapshotId: fixture.studentSnapshotId,
        programId: TEST_PROGRAM_ID,
        auditSource: 'demo-audit',
        auditVersion: fixture.auditVersion ?? 'audit_demo_r1',
        catalogYear: '2025-2026',
        generatedAt: new Date(fixture.generatedAt),
        studentRecordEffectiveAt: new Date(fixture.generatedAt),
        ingestedAt: new Date(fixture.ingestedAt ?? DEFAULT_INGESTED_AT),
      })
      .returning({ id: auditSnapshotTable.id });
    const id = AuditSnapshotIdSchema.parse(rows[0]?.id);
    const scope = { tenantId, auditSnapshotId: id, studentSnapshotId: fixture.studentSnapshotId };
    await insertRequirementResults(
      tx,
      scope,
      fixture.requirements.map((requirement) => ({
        label: 'Synthetic requirement',
        state: RequirementState.Incomplete,
        allocatedAttemptIds: [],
        candidateCourseIds: [],
        isReusable: false,
        sourceRef: `demo-audit:${requirement.sourceRequirementId}`,
        ...requirement,
      })),
    );
    return id;
  });
}
