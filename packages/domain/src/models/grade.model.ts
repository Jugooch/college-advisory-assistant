/**
 * @file Grade data object: a grading scheme and a value that is valid under that scheme.
 * @module @caa/domain/models/grade
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { GradeScheme, LetterGradeSchema, PassFailGradeSchema } from '../enums/grade-scheme.enum';

/** Schema for a numeric grade written as a non-negative decimal string, for example `87.5`. */
const NumericGradeValueSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Expected a non-negative decimal string');

/**
 * Schema for a grade as `{ scheme, value }`. The value set depends on the scheme:
 * - `LETTER`: one of `A+` … `F` ({@link LetterGradeSchema}). `P` is never a letter grade.
 * - `PASS_FAIL`: `P` or `F` only.
 * - `NUMERIC`: a decimal string, never a float.
 * - `UNKNOWN`: the raw source value, kept for provenance. The engine treats it as UNKNOWN.
 *
 * The domain deliberately encodes no grade ordering and no grade points. Whether `C-` meets a
 * `C` minimum is institution policy, supplied as configuration and applied by the engine.
 */
export const GradeSchema = z
  .discriminatedUnion('scheme', [
    z.object({ scheme: z.literal(GradeScheme.Letter), value: LetterGradeSchema }),
    z.object({ scheme: z.literal(GradeScheme.PassFail), value: PassFailGradeSchema }),
    z.object({ scheme: z.literal(GradeScheme.Numeric), value: NumericGradeValueSchema }),
    z.object({ scheme: z.literal(GradeScheme.Unknown), value: z.string().min(1) }),
  ])
  .readonly();

/** A validated, immutable grade. */
export type Grade = z.infer<typeof GradeSchema>;

/** Raw input accepted by {@link createGrade}. */
export type GradeInput = z.input<typeof GradeSchema>;

/**
 * Creates a validated, immutable grade.
 *
 * @param input - Raw grade fields.
 * @returns The parsed grade.
 * @throws {z.ZodError} When the scheme is unknown or the value is not valid for the scheme.
 */
export function createGrade(input: GradeInput): Grade {
  return GradeSchema.parse(input);
}
