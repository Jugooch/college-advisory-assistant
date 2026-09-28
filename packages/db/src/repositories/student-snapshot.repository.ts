/**
 * @file Read-only data access for student snapshots and the attempts each one contains.
 * @module @caa/db/repositories/student-snapshot
 * @requirement FR-05
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';

import type {
  CourseAttempt,
  InstitutionId,
  StudentId,
  StudentSnapshot,
  StudentSnapshotId,
} from '@caa/domain';

import type { Database } from '../client';
import { toCourseAttempt } from '../mappers/course-attempt.mapper';
import { toStudentSnapshot } from '../mappers/student-snapshot.mapper';
import { courseAttemptTable } from '../tables/course-attempt.table';
import { studentTable } from '../tables/student.table';
import { type StudentSnapshotRow, studentSnapshotTable } from '../tables/student-snapshot.table';
import { studentSnapshotAttemptTable } from '../tables/student-snapshot-attempt.table';

/** A snapshot together with its attempts, in the snapshot's `attemptIds` order. */
export interface StudentSnapshotRevision {
  readonly snapshot: StudentSnapshot;
  readonly attempts: readonly CourseAttempt[];
}

/**
 * Result of {@link StudentSnapshotRepository.findLatest}. `AMBIGUOUS` means two snapshots
 * share the newest source effective time and ingestion time, so neither is newer.
 */
export type LatestStudentSnapshot =
  | { readonly status: 'FOUND'; readonly revision: StudentSnapshotRevision }
  | { readonly status: 'AMBIGUOUS' };

/** Reads student snapshots. Imported, immutable revisions, so there are no update methods. */
export interface StudentSnapshotRepository {
  /**
   * Finds the student's latest snapshot: the newest `sourceEffectiveAt`, never the newest
   * ingestion alone. At an equal source time the later ingestion wins; when both times are
   * equal the result is `AMBIGUOUS`, never an arbitrary pick.
   *
   * @param tenantId - Tenant that owns the student.
   * @param studentId - Student whose record is wanted.
   * @returns The latest revision or the ambiguity, or null when the student has no snapshot,
   *   belongs to another tenant, or was deleted by the source.
   * @throws {z.ZodError} When a stored snapshot or attempt is invalid.
   */
  findLatest(tenantId: InstitutionId, studentId: StudentId): Promise<LatestStudentSnapshot | null>;

  /**
   * Finds one pinned snapshot, for example the one an audit references.
   *
   * @param tenantId - Tenant that owns the snapshot.
   * @param id - Snapshot ID.
   * @returns The revision, or null when it doesn't exist, belongs to another tenant, or its
   *   student was deleted by the source.
   * @throws {z.ZodError} When the stored snapshot or an attempt is invalid.
   */
  findById(tenantId: InstitutionId, id: StudentSnapshotId): Promise<StudentSnapshotRevision | null>;
}

/**
 * Returns whether two snapshots are tied for newest, so neither is later.
 *
 * @param newest - The first row in "latest" order.
 * @param runnerUp - The second row, if any.
 * @returns `true` when both source effective and ingestion times are equal.
 */
function isTied(newest: StudentSnapshotRow, runnerUp: StudentSnapshotRow | undefined): boolean {
  return (
    runnerUp?.sourceEffectiveAt.getTime() === newest.sourceEffectiveAt.getTime() &&
    runnerUp.ingestedAt.getTime() === newest.ingestedAt.getTime()
  );
}

/**
 * Loads a snapshot's attempts in position order and builds the revision.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant that owns the snapshot.
 * @param row - The snapshot row.
 * @returns The snapshot with its attempts.
 * @throws {z.ZodError} When the snapshot or an attempt is invalid.
 */
async function loadRevision(
  db: Database,
  tenantId: InstitutionId,
  row: StudentSnapshotRow,
): Promise<StudentSnapshotRevision> {
  const links = studentSnapshotAttemptTable;
  // NOTE: snapshot rows and their links are never updated, so this second read can't see a
  // different attempt set than the one written with the snapshot.
  const rows = await db
    .select({ attempt: courseAttemptTable })
    .from(links)
    .innerJoin(
      courseAttemptTable,
      and(
        eq(courseAttemptTable.tenantId, links.tenantId),
        eq(courseAttemptTable.id, links.courseAttemptId),
      ),
    )
    .where(and(eq(links.tenantId, tenantId), eq(links.studentSnapshotId, row.id)))
    .orderBy(asc(links.position));
  const attempts = rows.map(({ attempt }) => toCourseAttempt(attempt));
  const attemptIds = attempts.map(({ id }) => id);
  return { snapshot: toStudentSnapshot(row, attemptIds), attempts };
}

/**
 * Creates the student snapshot repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link StudentSnapshotRepository}.
 */
export function createStudentSnapshotRepository(db: Database): StudentSnapshotRepository {
  const snapshots = studentSnapshotTable;

  const findRows = async (tenantId: InstitutionId, match: SQL, limit: number) => {
    const rows = await db
      .select({ snapshot: snapshots })
      .from(snapshots)
      .innerJoin(
        studentTable,
        and(
          eq(studentTable.tenantId, snapshots.tenantId),
          eq(studentTable.id, snapshots.studentId),
        ),
      )
      // SECURITY: every read is filtered by tenant; a tombstoned student's record is invisible.
      .where(and(eq(snapshots.tenantId, tenantId), eq(studentTable.isDeleted, false), match))
      .orderBy(desc(snapshots.sourceEffectiveAt), desc(snapshots.ingestedAt))
      .limit(limit);
    return rows.map(({ snapshot }) => snapshot);
  };

  return {
    async findLatest(tenantId, studentId) {
      const [newest, runnerUp] = await findRows(tenantId, eq(snapshots.studentId, studentId), 2);
      if (!newest) {
        return null;
      }
      // SAFETY: two revisions at the same source and ingestion time give no order, so the
      // caller gets the ambiguity instead of whichever row PostgreSQL returned first.
      if (isTied(newest, runnerUp)) {
        return { status: 'AMBIGUOUS' };
      }
      return { status: 'FOUND', revision: await loadRevision(db, tenantId, newest) };
    },

    async findById(tenantId, id) {
      const [found] = await findRows(tenantId, eq(snapshots.id, id), 1);
      return found ? loadRevision(db, tenantId, found) : null;
    },
  };
}
