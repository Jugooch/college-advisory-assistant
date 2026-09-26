/**
 * @file Read-only data access for advisor assignments.
 * @module @caa/db/repositories/advisor-assignment
 * @requirement FR-02
 */
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

import type { AdvisorAssignment, InstitutionId, StudentId, UserId } from '@caa/domain';

import type { Database } from '../client';
import { toAdvisorAssignment } from '../mappers/advisor-assignment.mapper';
import { advisorAssignmentTable } from '../tables/advisor-assignment.table';

/** Which assignment {@link AdvisorAssignmentRepository.findActive} looks for. */
export interface ActiveAssignmentQuery {
  readonly advisorUserId: UserId;
  readonly studentId: StudentId;
  /** Instant to evaluate at. ISO 8601 with offset; comes from an injected clock. */
  readonly at: string;
}

/** Reads advisor assignments. */
export interface AdvisorAssignmentRepository {
  /**
   * Finds an assignment that gives the advisor access to the student at the given instant.
   * Active means `effectiveFrom <= at` and (`effectiveTo` is null or `at < effectiveTo`).
   *
   * @param tenantId - Tenant that must own the assignment.
   * @param query - Advisor, student, and instant.
   * @returns The active assignment with the latest start, or null when none is active.
   * @throws {RangeError} When `at` is not a valid date-time.
   */
  findActive(
    tenantId: InstitutionId,
    query: ActiveAssignmentQuery,
  ): Promise<AdvisorAssignment | null>;
}

/**
 * Creates the advisor assignment repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link AdvisorAssignmentRepository}.
 */
export function createAdvisorAssignmentRepository(db: Database): AdvisorAssignmentRepository {
  return {
    async findActive(tenantId, { advisorUserId, studentId, at }) {
      const instant = new Date(at);
      if (Number.isNaN(instant.getTime())) {
        throw new RangeError('findActive requires a valid ISO 8601 instant');
      }
      const table = advisorAssignmentTable;
      const rows = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.tenantId, tenantId),
            eq(table.advisorUserId, advisorUserId),
            eq(table.studentId, studentId),
            // SECURITY: start is inclusive and end is exclusive, so access ends exactly at effectiveTo.
            lte(table.effectiveFrom, instant),
            or(isNull(table.effectiveTo), gt(table.effectiveTo, instant)),
          ),
        )
        .orderBy(desc(table.effectiveFrom))
        .limit(1);
      const row = rows[0];
      return row ? toAdvisorAssignment(row) : null;
    },
  };
}
