/**
 * @file Converts prerequisite rule rows into domain objects.
 * @module @caa/db/mappers/prerequisite-rule
 * @requirement FR-06
 */
import { type PrerequisiteRule, PrerequisiteRuleSchema } from '@caa/domain';

import type { PrerequisiteRuleRow } from '../tables/prerequisite-rule.table';

/**
 * Maps a database row to a validated domain object, parsing the stored expression tree.
 *
 * @param row - Row read from the `prerequisite_rule` table.
 * @returns The domain prerequisite rule.
 * @throws {z.ZodError} When the stored row violates the domain schema, including any invalid
 *   node of the expression tree.
 */
export function toPrerequisiteRule(row: PrerequisiteRuleRow): PrerequisiteRule {
  // NOTE: parsed with the schema rather than `createPrerequisiteRule`, because the stored JSON
  // is `unknown` until this parse validates it (docs/standards/04 rule 3).
  return PrerequisiteRuleSchema.parse({
    tenantId: row.tenantId,
    courseId: row.courseId,
    expression: row.expression,
    sourceRef: row.sourceRef,
    rulesetVersion: row.rulesetVersion,
  });
}
