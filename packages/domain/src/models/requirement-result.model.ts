/**
 * @file Requirement result: one requirement of a degree audit, with its allocation and remainder.
 * @module @caa/domain/models/requirement-result
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { RequirementState, RequirementStateSchema } from '../enums/requirement-state.enum';
import { CourseIdSchema } from './course.model';
import { CourseAttemptIdSchema } from './course-attempt.model';

/**
 * Returns whether a list has no repeated values.
 *
 * @param values - Values to check.
 * @returns `true` when every value appears once.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Schema for a requirement result. The audit owns allocation: the engine reads these fields and
 * never reconstructs them from prose or course lists.
 */
export const RequirementResultSchema = z
  .object({
    /** Requirement identifier in the audit system. Unique within one audit snapshot. */
    sourceRequirementId: z.string().min(1),
    /** Display text such as `Mathematics core`. Never used as identity. */
    label: z.string().min(1),
    state: RequirementStateSchema,
    /** Attempts the audit has allocated to this requirement. */
    allocatedAttemptIds: z.array(CourseAttemptIdSchema).readonly(),
    /**
     * Credits still needed, in hundredths of a credit (350 = 3.5 credits), or `null` when the
     * audit doesn't measure this requirement in credits.
     */
    remainingCreditsHundredths: z.number().int().nonnegative().nullable(),
    /** Courses still needed, or `null` when the audit doesn't measure this in courses. */
    remainingCourseCount: z.number().int().nonnegative().nullable(),
    /** Courses the audit says may apply to this requirement. */
    candidateCourseIds: z.array(CourseIdSchema).readonly(),
    /**
     * Whether a course counted here may also count toward another requirement. Mappers set
     * `false` when the audit doesn't say, so reuse is never assumed.
     */
    isReusable: z.boolean(),
    /** Reference to the requirement in the audit, shown as evidence. */
    sourceRef: z.string().min(1),
  })
  // SAFETY: a COMPLETE requirement that still needs credits or courses contradicts itself; the
  // engine must not choose which half of that to believe.
  .refine(
    (result) =>
      result.state !== RequirementState.Complete ||
      ((result.remainingCreditsHundredths ?? 0) === 0 && (result.remainingCourseCount ?? 0) === 0),
    {
      message: 'A COMPLETE requirement must not have a remaining quantity greater than 0',
      path: ['state'],
    },
  )
  // SAFETY: a repeated allocated attempt would count the same credits twice.
  .refine((result) => isDistinct(result.allocatedAttemptIds), {
    message: 'allocatedAttemptIds must not repeat an attempt',
    path: ['allocatedAttemptIds'],
  })
  .refine((result) => isDistinct(result.candidateCourseIds), {
    message: 'candidateCourseIds must not repeat a course',
    path: ['candidateCourseIds'],
  })
  .readonly();

/** A validated, immutable requirement result. */
export type RequirementResult = z.infer<typeof RequirementResultSchema>;

/** Raw input accepted by {@link createRequirementResult}. */
export type RequirementResultInput = z.input<typeof RequirementResultSchema>;

/**
 * Creates a validated, immutable requirement result.
 *
 * @param input - Raw requirement fields.
 * @returns The parsed requirement result.
 * @throws {z.ZodError} When a field is invalid, a COMPLETE requirement has a remaining quantity,
 *   or an attempt or candidate course is repeated.
 */
export function createRequirementResult(input: RequirementResultInput): RequirementResult {
  return RequirementResultSchema.parse(input);
}
