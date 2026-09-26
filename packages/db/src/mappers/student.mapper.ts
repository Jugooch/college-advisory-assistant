/**
 * @file Converts student rows into domain objects.
 * @module @caa/db/mappers/student
 * @requirement FR-02
 */
import { createStudent, type Student } from '@caa/domain';

import type { StudentRow } from '../tables/student.table';

/**
 * Maps a database row to a validated domain object. Import bookkeeping columns stay in the
 * database.
 *
 * @param row - Row read from the `student` table.
 * @returns The domain student.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toStudent(row: StudentRow): Student {
  return createStudent({
    id: row.id,
    tenantId: row.tenantId,
    sourceStudentId: row.sourceStudentId,
    userId: row.userId,
  });
}
