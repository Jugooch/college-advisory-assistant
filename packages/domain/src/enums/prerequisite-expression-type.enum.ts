/**
 * @file Node types of a prerequisite expression tree.
 * @module @caa/domain/enums/prerequisite-expression-type
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

/**
 * Node type in a prerequisite expression.
 *
 * - `ALL`: every child must be satisfied (AND).
 * - `ANY`: at least one child must be satisfied (OR). The children are alternatives, not an
 *   ordered list of required courses.
 * - `COURSE`: one course, optionally with a minimum grade.
 * - `UNSUPPORTED`: source semantics the parser couldn't represent. The engine returns UNKNOWN.
 * - `NONE`: the institution states the course has no prerequisite. Allowed only as the root of
 *   a rule's expression (`PrerequisiteRootExpression`), never inside `ALL` or `ANY`. It is
 *   distinct from a missing rule, which means the rule wasn't imported and is UNKNOWN (#141).
 */
export const PrerequisiteExpressionType = {
  All: 'ALL',
  Any: 'ANY',
  Course: 'COURSE',
  Unsupported: 'UNSUPPORTED',
  None: 'NONE',
} as const;

/** Union of every {@link PrerequisiteExpressionType} value. */
export type PrerequisiteExpressionType =
  (typeof PrerequisiteExpressionType)[keyof typeof PrerequisiteExpressionType];

/** Runtime schema for {@link PrerequisiteExpressionType}. */
export const PrerequisiteExpressionTypeSchema = z.enum(PrerequisiteExpressionType);
