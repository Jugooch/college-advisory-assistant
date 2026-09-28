/**
 * @file Converts student snapshot rows into domain objects.
 * @module @caa/db/mappers/student-snapshot
 * @requirement FR-05
 * @requirement NFR-01
 */
import { createStudentSnapshot, type StudentSnapshot } from '@caa/domain';

import type { StudentSnapshotRow } from '../tables/student-snapshot.table';

/**
 * Maps a database row and its linked attempt IDs to a validated domain object.
 *
 * @param row - Row read from the `student_snapshot` table.
 * @param attemptIds - IDs from `student_snapshot_attempt`, in position order.
 * @returns The domain student snapshot, with timestamps as ISO strings.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toStudentSnapshot(
  row: StudentSnapshotRow,
  attemptIds: readonly string[],
): StudentSnapshot {
  return createStudentSnapshot({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    programId: row.programId,
    catalogYear: row.catalogYear,
    attemptIds,
    sourceEffectiveAt: row.sourceEffectiveAt.toISOString(),
    ingestedAt: row.ingestedAt.toISOString(),
  });
}
