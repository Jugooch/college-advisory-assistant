/**
 * @file Check evidence data object: the ruleset and the decisive rule leaves behind one check.
 * @module @caa/domain/models/check-evidence
 * @requirement FR-09
 * @requirement FR-10
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { PrerequisiteExpressionType } from '../enums/prerequisite-expression-type.enum';
import { ReasonCodeSchema } from '../enums/reason-code.enum';
import { CourseIdSchema } from './course.model';
import { CourseAttemptIdSchema } from './course-attempt.model';
import { GradeSchema } from './grade.model';

/**
 * Schema for a path through a rule expression: the child index at each `ALL` or `ANY` node,
 * from the root down. `[]` is the root itself, so a rule that is a single course has path `[]`.
 */
export const ExpressionPathSchema = z.array(z.number().int().nonnegative()).readonly();

/** A validated, immutable path through a rule expression. */
export type ExpressionPath = z.infer<typeof ExpressionPathSchema>;

/**
 * Schema for one leaf of a rule expression that decided the check's state. A decisive leaf has
 * the check's state, so the state isn't repeated here. Leaf types mirror the rule expression:
 * - `COURSE`: a required course, the grade it needs, and the attempts considered for it.
 * - `UNSUPPORTED`: source semantics the app can't represent. The check is always UNKNOWN.
 */
export const DecisiveLeafSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal(PrerequisiteExpressionType.Course),
      path: ExpressionPathSchema,
      courseId: CourseIdSchema,
      /** The leaf's minimum grade, or `null` when any passing completion satisfies it. */
      requiredGrade: GradeSchema.nullable(),
      /**
       * Every attempt of the course or its equivalents that was considered, in input order.
       * Empty when the student has none or the catalog can't place the course.
       */
      attemptIds: z.array(CourseAttemptIdSchema).readonly(),
      /** Why this leaf didn't pass, or `null` when the check passed. */
      reasonCode: ReasonCodeSchema.nullable(),
    }),
    z.object({
      type: z.literal(PrerequisiteExpressionType.Unsupported),
      path: ExpressionPathSchema,
      /** The source rule text the parser couldn't represent, verbatim. */
      sourceText: z.string().min(1),
      reasonCode: ReasonCodeSchema,
    }),
  ])
  .readonly();

/** A validated, immutable decisive leaf. */
export type DecisiveLeaf = z.infer<typeof DecisiveLeafSchema>;

/**
 * Schema for the evidence behind one check (planning/08 §Evidence contract). The fields are
 * common to every check kind, so one shape serves the engine, the API contract, and the golden
 * corpus. Consistency with the check's own kind and state is enforced by `CheckResultSchema`.
 */
export const CheckEvidenceSchema = z
  .object({
    /**
     * Published ruleset version the check applied, for example `demo-2026.1`, or `null` when
     * the check applied no published ruleset (for example a seat status read from the SIS).
     */
    rulesetVersion: z.string().min(1).nullable(),
    /**
     * The expression leaves that decided the state, in source order. At each `ALL` or `ANY`
     * node these are the leaves of every child whose state equals the node's state. Empty when
     * the check doesn't evaluate a rule expression, or no single leaf decided it.
     */
    decisiveLeaves: z.array(DecisiveLeafSchema).readonly(),
  })
  .readonly();

/** A validated, immutable check evidence object. */
export type CheckEvidence = z.infer<typeof CheckEvidenceSchema>;

/** Raw input accepted by {@link createCheckEvidence}. */
export type CheckEvidenceInput = z.input<typeof CheckEvidenceSchema>;

/**
 * Creates validated, immutable check evidence.
 *
 * @param input - Raw evidence fields.
 * @returns The parsed check evidence.
 * @throws {z.ZodError} When a field is invalid, a path index is negative or fractional, or a
 *   leaf type is unknown.
 */
export function createCheckEvidence(input: CheckEvidenceInput): CheckEvidence {
  return CheckEvidenceSchema.parse(input);
}
