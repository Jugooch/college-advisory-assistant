/**
 * @file Read-only data access for a tenant's course catalog.
 * @module @caa/db/repositories/course-catalog
 * @requirement FR-06
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { asc, eq } from 'drizzle-orm';

import type { Course, InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toCourse } from '../mappers/course.mapper';
import { courseTable } from '../tables/course.table';

/** Reads catalog courses. Institutional source data, so there are no update methods. */
export interface CourseCatalogRepository {
  /**
   * Lists every course in a tenant's catalog.
   *
   * @param tenantId - Tenant that owns the catalog.
   * @returns The courses ordered by source course ID, or an empty list when none are stored.
   * @throws {z.ZodError} When a stored course violates the domain schema.
   */
  findCatalog(tenantId: InstitutionId): Promise<readonly Course[]>;
}

/**
 * Creates the course catalog repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link CourseCatalogRepository}.
 */
export function createCourseCatalogRepository(db: Database): CourseCatalogRepository {
  return {
    async findCatalog(tenantId) {
      const rows = await db
        .select()
        .from(courseTable)
        // SECURITY: every read is filtered by tenant.
        .where(eq(courseTable.tenantId, tenantId))
        .orderBy(asc(courseTable.sourceCourseId));
      return rows.map(toCourse);
    },
  };
}
