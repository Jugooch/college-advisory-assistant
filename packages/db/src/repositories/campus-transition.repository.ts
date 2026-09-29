/**
 * @file Read-only data access for a tenant's versioned campus transition table.
 * @module @caa/db/repositories/campus-transition
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { and, asc, desc, eq } from 'drizzle-orm';

import type { CampusTransitionPolicy, InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toCampusTransitionPolicy } from '../mappers/campus-transition-policy.mapper';
import {
  campusTransitionTable,
  campusTransitionVersionTable,
} from '../tables/campus-transition.table';

/** Reads campus transition tables. Published versions are immutable; no update methods. */
export interface CampusTransitionRepository {
  /**
   * Finds the tenant's current transition table: the version published most recently. The
   * database refuses two versions with one publication time, so "current" is never tied.
   *
   * @param tenantId - Tenant whose table is wanted.
   * @returns The policy with its version and pairs, or null when the tenant has published
   *   none. A pair it doesn't list is unknown, never zero.
   * @throws {z.ZodError} When the stored policy is invalid.
   */
  findPolicy(tenantId: InstitutionId): Promise<CampusTransitionPolicy | null>;
}

/**
 * Creates the campus transition repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link CampusTransitionRepository}.
 */
export function createCampusTransitionRepository(db: Database): CampusTransitionRepository {
  const versions = campusTransitionVersionTable;
  const transitions = campusTransitionTable;
  return {
    async findPolicy(tenantId) {
      const [current] = await db
        .select()
        .from(versions)
        // SECURITY: every read is filtered by tenant.
        .where(eq(versions.tenantId, tenantId))
        .orderBy(desc(versions.publishedAt))
        .limit(1);
      if (!current) {
        return null;
      }
      const rows = await db
        .select()
        .from(transitions)
        .where(and(eq(transitions.tenantId, tenantId), eq(transitions.version, current.version)))
        .orderBy(asc(transitions.fromCampusId), asc(transitions.toCampusId));
      return toCampusTransitionPolicy(current, rows);
    },
  };
}
