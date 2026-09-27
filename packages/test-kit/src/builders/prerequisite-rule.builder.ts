/**
 * @file Builds synthetic prerequisite rules and readable prerequisite expressions for tests.
 * @module @caa/test-kit/builders/prerequisite-rule
 */
import {
  createPrerequisiteExpression,
  createPrerequisiteRule,
  type GradeInput,
  type PrerequisiteExpression,
  PrerequisiteExpressionType,
  type PrerequisiteRule,
  type PrerequisiteRuleInput,
  ReasonCode,
} from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { letter } from './grade.builder';

/**
 * Builds an `ALL` node: every child must be satisfied.
 *
 * @param items - Child expressions; at least one.
 * @returns A validated expression.
 * @throws {z.ZodError} When no child is given.
 */
export function all(...items: PrerequisiteExpression[]): PrerequisiteExpression {
  return createPrerequisiteExpression({ type: PrerequisiteExpressionType.All, items });
}

/**
 * Builds an `ANY` node: at least one child must be satisfied.
 *
 * @param items - Alternative child expressions; at least one.
 * @returns A validated expression.
 * @throws {z.ZodError} When no child is given.
 */
export function any(...items: PrerequisiteExpression[]): PrerequisiteExpression {
  return createPrerequisiteExpression({ type: PrerequisiteExpressionType.Any, items });
}

/**
 * Builds a `COURSE` node, for example `course(SYNTHETIC_COURSES.math101.id, letter('C'))`.
 *
 * @param courseId - The required course.
 * @param minimumGrade - Minimum grade, or `null` (the default) when any passing completion counts.
 * @returns A validated expression.
 */
export function course(
  courseId: string,
  minimumGrade: GradeInput | null = null,
): PrerequisiteExpression {
  return createPrerequisiteExpression({
    type: PrerequisiteExpressionType.Course,
    courseId,
    minimumGrade,
  });
}

/**
 * Builds an `UNSUPPORTED` node that keeps the source text verbatim.
 *
 * @param sourceText - The original rule text the parser couldn't represent.
 * @param reasonCode - Why it is unsupported; defaults to `UNSUPPORTED_RULE`.
 * @returns A validated expression.
 */
export function unsupported(
  sourceText: string,
  reasonCode: ReasonCode = ReasonCode.UnsupportedRule,
): PrerequisiteExpression {
  return createPrerequisiteExpression({
    type: PrerequisiteExpressionType.Unsupported,
    sourceText,
    reasonCode,
  });
}

/**
 * Builds a valid prerequisite rule in tenant A, ruleset `demo-2026.1`: DEMO-MATH 102 requires
 * DEMO-MATH 101 with at least a letter `C`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes rules; drives the default `sourceRef`, for example `demo-rule-0001`.
 * @returns A validated prerequisite rule.
 */
export function buildPrerequisiteRule(
  overrides: Partial<PrerequisiteRuleInput> = {},
  seed = 1,
): PrerequisiteRule {
  return createPrerequisiteRule({
    tenantId: SYNTHETIC_TENANTS.a.id,
    courseId: SYNTHETIC_COURSES.math102.id,
    expression: course(SYNTHETIC_COURSES.math101.id, letter('C')),
    sourceRef: `demo-rule-${String(seed).padStart(4, '0')}`,
    rulesetVersion: 'demo-2026.1',
    ...overrides,
  });
}
