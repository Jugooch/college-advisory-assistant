/**
 * @file Read-only data access for imported students.
 * @module @caa/db/repositories/student
 * @requirement FR-02
 */
import { and, eq, type SQL } from 'drizzle-orm';

import type { InstitutionId, Student, StudentId } from '@caa/domain';

import type { Database } from '../client';
import { toStudent } from '../mappers/student.mapper';
import { studentTable } from '../tables/student.table';

/** Reads students. Imported source data, so there are no update methods. */
export interface StudentRepository {
  /**
   * Finds one student in a tenant by internal ID.
   *
   * @param tenantId - Tenant that must own the student.
   * @param id - Internal student ID.
   * @returns The student, or null when it doesn't exist, belongs to another tenant, or was
   *   deleted by the source.
   */
  findById(tenantId: InstitutionId, id: StudentId): Promise<Student | null>;

  /**
   * Finds one student in a tenant by source-system ID.
   *
   * @param tenantId - Tenant that must own the student.
   * @param sourceStudentId - Student ID in the source system.
   * @returns The student, or null when it doesn't exist or was deleted by the source.
   */
  findBySourceStudentId(tenantId: InstitutionId, sourceStudentId: string): Promise<Student | null>;
}

/**
 * Creates the student repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link StudentRepository}.
 */
export function createStudentRepository(db: Database): StudentRepository {
  const findOne = async (tenantId: InstitutionId, match: SQL): Promise<Student | null> => {
    const rows = await db
      .select()
      .from(studentTable)
      // SECURITY: every read is filtered by tenant; tombstoned students are invisible.
      .where(and(eq(studentTable.tenantId, tenantId), eq(studentTable.isDeleted, false), match))
      .limit(1);
    const row = rows[0];
    return row ? toStudent(row) : null;
  };

  return {
    findById: (tenantId, id) => findOne(tenantId, eq(studentTable.id, id)),
    findBySourceStudentId: (tenantId, sourceStudentId) =>
      findOne(tenantId, eq(studentTable.sourceStudentId, sourceStudentId)),
  };
}
