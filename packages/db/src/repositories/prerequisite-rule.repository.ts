/**
 * @file Read-only data access for versioned prerequisite rules.
 * @module @caa/db/repositories/prerequisite-rule
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { and, eq } from 'drizzle-orm';

import type { CourseId, InstitutionId, PrerequisiteRule } from '@caa/domain';

import type { Database } from '../client';
import { toPrerequisiteRule } from '../mappers/prerequisite-rule.mapper';
import { prerequisiteRuleTable } from '../tables/prerequisite-rule.table';

/**
 * Reads prerequisite rules. Published rulesets are immutable, so there are no update methods:
 * a changed rule is a new row under a new ruleset version (planning/08 §Rule lifecycle).
 */
export interface PrerequisiteRuleRepository {
  /**
   * Finds the rule for one course in one ruleset version.
   *
   * @param tenantId - Tenant that owns the rule.
   * @param courseId - Course whose prerequisites the rule states.
   * @param rulesetVersion - Published ruleset version, for example `demo-2026.1`.
   * @returns The rule, or null when that version has no rule for the course.
   * @throws {z.ZodError} When the stored rule or its expression tree is invalid.
   */
  findRule(
    tenantId: InstitutionId,
    courseId: CourseId,
    rulesetVersion: string,
  ): Promise<PrerequisiteRule | null>;
}

/**
 * Creates the prerequisite rule repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link PrerequisiteRuleRepository}.
 */
export function createPrerequisiteRuleRepository(db: Database): PrerequisiteRuleRepository {
  const table = prerequisiteRuleTable;
  return {
    async findRule(tenantId, courseId, rulesetVersion) {
      const rows = await db
        .select()
        .from(table)
        .where(
          and(
            // SECURITY: every read is filtered by tenant.
            eq(table.tenantId, tenantId),
            eq(table.courseId, courseId),
            eq(table.rulesetVersion, rulesetVersion),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? toPrerequisiteRule(row) : null;
    },
  };
}
