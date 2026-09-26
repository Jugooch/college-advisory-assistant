/**
 * @file Converts advisor assignment rows into domain objects.
 * @module @caa/db/mappers/advisor-assignment
 * @requirement FR-02
 */
import { type AdvisorAssignment, createAdvisorAssignment } from '@caa/domain';

import type { AdvisorAssignmentRow } from '../tables/advisor-assignment.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `advisor_assignment` table.
 * @returns The domain advisor assignment, with timestamps as ISO strings.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toAdvisorAssignment(row: AdvisorAssignmentRow): AdvisorAssignment {
  return createAdvisorAssignment({
    id: row.id,
    tenantId: row.tenantId,
    advisorUserId: row.advisorUserId,
    studentId: row.studentId,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo === null ? null : row.effectiveTo.toISOString(),
    approvedBy: row.approvedBy,
  });
}
