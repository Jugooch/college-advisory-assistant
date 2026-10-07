/**
 * @file Prerequisite rule: the prerequisite expression for one course in one ruleset version.
 * @module @caa/domain/models/prerequisite-rule
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { CourseIdSchema } from './course.model';
import { InstitutionIdSchema } from './institution.model';
import { PrerequisiteRootExpressionSchema } from './prerequisite-expression.model';

/**
 * Schema for a prerequisite rule. Published rules are immutable; a change is a new
 * `rulesetVersion`, so `tenantId` + `courseId` + `rulesetVersion` identifies a rule.
 */
export const PrerequisiteRuleSchema = z
  .object({
    tenantId: InstitutionIdSchema,
    /** Course whose prerequisites this rule states. */
    courseId: CourseIdSchema,
    /**
     * What the institution states about prerequisites. `NONE` means the institution states the
     * course has none. A course with no rule row has not been imported, which is UNKNOWN.
     */
    expression: PrerequisiteRootExpressionSchema,
    /** Reference to the source rule, for example a catalog rule ID. Shown as evidence. */
    sourceRef: z.string().min(1),
    /** Published ruleset version this rule belongs to, for example `demo-2026.1`. */
    rulesetVersion: z.string().min(1),
  })
  .readonly();

/** A validated, immutable prerequisite rule. */
export type PrerequisiteRule = z.infer<typeof PrerequisiteRuleSchema>;

/** Raw input accepted by {@link createPrerequisiteRule}. */
export type PrerequisiteRuleInput = z.input<typeof PrerequisiteRuleSchema>;

/**
 * Creates a validated, immutable prerequisite rule.
 *
 * @param input - Raw rule fields.
 * @returns The parsed prerequisite rule.
 * @throws {z.ZodError} When a field or any node of the expression is invalid.
 */
export function createPrerequisiteRule(input: PrerequisiteRuleInput): PrerequisiteRule {
  return PrerequisiteRuleSchema.parse(input);
}
