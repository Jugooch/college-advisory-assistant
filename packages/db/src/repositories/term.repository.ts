/**
 * @file Read-only data access for a tenant's term calendar.
 * @module @caa/db/repositories/term
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { asc, eq } from 'drizzle-orm';

import { createTermCalendar, type InstitutionId, type TermCalendar } from '@caa/domain';

import type { Database } from '../client';
import { toTerm } from '../mappers/term.mapper';
import { termTable } from '../tables/term.table';

/** Reads terms. Institutional source data, so there are no update methods. */
export interface TermRepository {
  /**
   * Lists a tenant's terms as a validated calendar, oldest first.
   *
   * @param tenantId - Tenant that owns the terms.
   * @returns The calendar ordered by `sequence`; empty when the tenant supplied no terms.
   * @throws {z.ZodError} When a stored term is invalid or the calendar breaks its invariants
   *   (one tenant, unique term codes, strictly increasing sequence).
   */
  findOrdered(tenantId: InstitutionId): Promise<TermCalendar>;
}

/**
 * Creates the term repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link TermRepository}.
 */
export function createTermRepository(db: Database): TermRepository {
  return {
    async findOrdered(tenantId) {
      const rows = await db
        .select()
        .from(termTable)
        // SECURITY: every read is filtered by tenant.
        .where(eq(termTable.tenantId, tenantId))
        .orderBy(asc(termTable.sequence));
      // SAFETY: the calendar schema re-checks the order and uniqueness the unique keys enforce,
      // so a broken calendar fails here instead of misordering attempts in the engine.
      return createTermCalendar(rows.map(toTerm));
    },
  };
}
