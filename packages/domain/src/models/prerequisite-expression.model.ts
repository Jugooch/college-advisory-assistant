/**
 * @file Prerequisite expression: a source-faithful AND/OR tree of course requirements.
 * @module @caa/domain/models/prerequisite-expression
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { PrerequisiteExpressionType } from '../enums/prerequisite-expression-type.enum';
import { type ReasonCode, ReasonCodeSchema } from '../enums/reason-code.enum';
import { type CourseId, CourseIdSchema } from './course.model';
import { type Grade, type GradeInput, GradeSchema } from './grade.model';

/** All children must be satisfied (AND). */
export interface AllPrerequisite {
  readonly type: typeof PrerequisiteExpressionType.All;
  readonly items: readonly PrerequisiteExpression[];
}

/**
 * At least one child must be satisfied (OR). The children are alternatives, never an ordered
 * list of compulsory courses (planning/08 §Eligibility semantics).
 */
export interface AnyPrerequisite {
  readonly type: typeof PrerequisiteExpressionType.Any;
  readonly items: readonly PrerequisiteExpression[];
}

/**
 * One required course. Equivalents are resolved by the engine through the course's
 * `equivalencyGroupId`, so they are never listed here.
 */
export interface CoursePrerequisite {
  readonly type: typeof PrerequisiteExpressionType.Course;
  readonly courseId: CourseId;
  /** Minimum grade required, or `null` when any completed attempt satisfies the course. */
  readonly minimumGrade: Grade | null;
}

/** Source semantics the parser couldn't represent. The engine returns UNKNOWN, never PASS. */
export interface UnsupportedPrerequisite {
  readonly type: typeof PrerequisiteExpressionType.Unsupported;
  /** The original rule text from the source, kept verbatim for review. */
  readonly sourceText: string;
  readonly reasonCode: ReasonCode;
}

/** A validated, immutable prerequisite expression tree. */
export type PrerequisiteExpression =
  AllPrerequisite | AnyPrerequisite | CoursePrerequisite | UnsupportedPrerequisite;

/** Raw input accepted by {@link createPrerequisiteExpression}. */
export type PrerequisiteExpressionInput =
  | {
      type: typeof PrerequisiteExpressionType.All | typeof PrerequisiteExpressionType.Any;
      items: readonly PrerequisiteExpressionInput[];
    }
  | {
      type: typeof PrerequisiteExpressionType.Course;
      courseId: string;
      minimumGrade: GradeInput | null;
    }
  | {
      type: typeof PrerequisiteExpressionType.Unsupported;
      sourceText: string;
      reasonCode: ReasonCode;
    };

/**
 * Children of an `ALL` or `ANY` node. An empty group has no source meaning, so it is rejected
 * rather than read as vacuously true (`ALL`) or false (`ANY`).
 */
const ItemsSchema = z
  .array(z.lazy(() => PrerequisiteExpressionSchema))
  .min(1)
  .readonly();

/**
 * Schema for a prerequisite expression. Recursive through `ALL` and `ANY` nodes.
 *
 * The explicit type annotation is required because TypeScript can't infer a recursive schema.
 */
export const PrerequisiteExpressionSchema: z.ZodType<
  PrerequisiteExpression,
  PrerequisiteExpressionInput
> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal(PrerequisiteExpressionType.All), items: ItemsSchema }).readonly(),
    z.object({ type: z.literal(PrerequisiteExpressionType.Any), items: ItemsSchema }).readonly(),
    z
      .object({
        type: z.literal(PrerequisiteExpressionType.Course),
        courseId: CourseIdSchema,
        minimumGrade: GradeSchema.nullable(),
      })
      .readonly(),
    z
      .object({
        type: z.literal(PrerequisiteExpressionType.Unsupported),
        sourceText: z.string().min(1),
        reasonCode: ReasonCodeSchema,
      })
      .readonly(),
  ]),
);

/**
 * Creates a validated, immutable prerequisite expression tree.
 *
 * @param input - Raw expression tree.
 * @returns The parsed expression.
 * @throws {z.ZodError} When a node type is unknown, an `ALL` or `ANY` node is empty, or a
 *   field is invalid at any depth.
 */
export function createPrerequisiteExpression(
  input: PrerequisiteExpressionInput,
): PrerequisiteExpression {
  return PrerequisiteExpressionSchema.parse(input);
}
