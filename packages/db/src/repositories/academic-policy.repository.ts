/**
 * @file Read-only data access for versioned academic policy.
 * @module @caa/db/repositories/academic-policy
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { and, eq } from 'drizzle-orm';

import type { AcademicPolicy, InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { toAcademicPolicy } from '../mappers/academic-policy.mapper';
import { academicPolicyTable } from '../tables/academic-policy.table';

/**
 * Reads academic policy. Published policy is immutable, so there are no update methods: a
 * change is a new row under a new ruleset version (planning/08 §Rule lifecycle).
 */
export interface AcademicPolicyRepository {
  /**
   * Finds the policy of one ruleset version.
   *
   * @param tenantId - Tenant that owns the policy.
   * @param rulesetVersion - Published ruleset version, for example `demo-2026.1`.
   * @returns The policy, or null when the tenant has none for that version.
   * @throws {z.ZodError} When the stored policy violates the domain schema.
   */
  findPolicy(tenantId: InstitutionId, rulesetVersion: string): Promise<AcademicPolicy | null>;
}

/**
 * Creates the academic policy repository.
 *
 * @param db - Typed database handle.
 * @returns An {@link AcademicPolicyRepository}.
 */
export function createAcademicPolicyRepository(db: Database): AcademicPolicyRepository {
  const table = academicPolicyTable;
  return {
    async findPolicy(tenantId, rulesetVersion) {
      const rows = await db
        .select()
        .from(table)
        // SECURITY: every read is filtered by tenant.
        .where(and(eq(table.tenantId, tenantId), eq(table.rulesetVersion, rulesetVersion)))
        .limit(1);
      const row = rows[0];
      return row ? toAcademicPolicy(row) : null;
    },
  };
}
