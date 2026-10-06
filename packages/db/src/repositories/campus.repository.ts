/**
 * @file Read-only data access for a tenant's campuses.
 * @module @caa/db/repositories/campus
 * @requirement FR-07
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { and, asc, eq, inArray } from 'drizzle-orm';

import type { Campus, CampusId, InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toCampus } from '../mappers/campus.mapper';
import { campusTable } from '../tables/campus.table';

/** Reads campuses. Institutional source data, so there are no update methods. */
export interface CampusRepository {
  /**
   * Finds a tenant's campuses by ID.
   *
   * @param tenantId - Tenant that owns the campuses.
   * @param campusIds - Campuses to read. Repeats count once.
   * @returns The campuses found, ordered by `id`. An ID of another tenant, or of no campus, is
   *   absent. An empty list returns an empty result without a query.
   * @throws {z.ZodError} When a stored campus violates the domain schema.
   */
  findByIds(tenantId: InstitutionId, campusIds: readonly CampusId[]): Promise<readonly Campus[]>;
}

/**
 * Creates the campus repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link CampusRepository}.
 */
export function createCampusRepository(db: Database): CampusRepository {
  return {
    async findByIds(tenantId, campusIds) {
      if (campusIds.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(campusTable)
        // SECURITY: every read is filtered by tenant, so another tenant's ID matches nothing.
        .where(and(eq(campusTable.tenantId, tenantId), inArray(campusTable.id, [...campusIds])))
        .orderBy(asc(campusTable.id));
      return rows.map(toCampus);
    },
  };
}
