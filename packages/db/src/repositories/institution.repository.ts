/**
 * @file Data access for institutions.
 * @module @caa/db/repositories/institution
 */
import { eq } from 'drizzle-orm';

import type { Institution, InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toInstitution } from '../mappers/institution.mapper';
import { institutionTable } from '../tables/institution.table';

/** Reads institutions. The institution is the tenant, so no separate tenant ID is taken. */
export interface InstitutionRepository {
  /**
   * Finds one institution by its ID.
   *
   * @param id - Institution ID.
   * @returns The institution, or null when none exists.
   */
  findById(id: InstitutionId): Promise<Institution | null>;
}

/**
 * Creates the institution repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link InstitutionRepository}.
 */
export function createInstitutionRepository(db: Database): InstitutionRepository {
  return {
    async findById(id) {
      const rows = await db
        .select()
        .from(institutionTable)
        .where(eq(institutionTable.id, id))
        .limit(1);
      const row = rows[0];
      return row ? toInstitution(row) : null;
    },
  };
}
