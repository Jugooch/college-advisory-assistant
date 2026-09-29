/**
 * @file Read-only data access for imported students.
 * @module @caa/db/repositories/student
 * @requirement FR-02
 */
import { and, eq, type SQL } from 'drizzle-orm';

import type { InstitutionId, Student, StudentId, UserId } from '@caa/domain';

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
 * Finds a signed-in user's own student record. Kept apart from {@link StudentRepository} so
 * existing test doubles of that interface stay valid; `createStudentRepository` implements both.
 */
export interface StudentUserLinkRepository {
  /**
   * Finds the student a signed-in user is linked to, in that user's tenant.
   *
   * @param tenantId - Tenant from the authenticated session.
   * @param userId - User identity ID from the authenticated session.
   * @returns The linked student, or null when the user has no student link in this tenant or
   *   the linked student was deleted by the source.
   * @throws {Error} When more than one current student is linked to the user; the link is
   *   ambiguous, so no student is chosen.
   */
  findByUserId(tenantId: InstitutionId, userId: UserId): Promise<Student | null>;
}

/**
 * Creates the student repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link StudentRepository} that is also a {@link StudentUserLinkRepository}.
 */
export function createStudentRepository(
  db: Database,
): StudentRepository & StudentUserLinkRepository {
  const findOne = async (tenantId: InstitutionId, match: SQL): Promise<Student | null> => {
    const rows = await db
      .select()
      .from(studentTable)
      // SECURITY: every read is filtered by tenant; tombstoned students are invisible.
      .where(and(eq(studentTable.tenantId, tenantId), eq(studentTable.isDeleted, false), match))
      // NOTE: two rows, so a match that isn't unique is detected instead of picked.
      .limit(2);
    if (rows.length > 1) {
      throw new Error('Student lookup matched more than one current student');
    }
    const row = rows[0];
    return row ? toStudent(row) : null;
  };

  return {
    findById: (tenantId, id) => findOne(tenantId, eq(studentTable.id, id)),
    findBySourceStudentId: (tenantId, sourceStudentId) =>
      findOne(tenantId, eq(studentTable.sourceStudentId, sourceStudentId)),
    findByUserId: (tenantId, userId) => findOne(tenantId, eq(studentTable.userId, userId)),
  };
}
