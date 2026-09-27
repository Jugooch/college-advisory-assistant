/**
 * @file Course data object: a tenant's catalog course, its credit value, and equivalency group.
 * @module @caa/domain/models/course
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a course ID can never be passed where another ID is expected. */
export const CourseIdSchema = z.uuid().brand<'CourseId'>();

/** Unique identifier of a {@link Course}. */
export type CourseId = z.infer<typeof CourseIdSchema>;

/** Branded ID of a group of courses the institution treats as equivalent to one another. */
export const EquivalencyGroupIdSchema = z.uuid().brand<'EquivalencyGroupId'>();

/** Unique identifier of an equivalency group. */
export type EquivalencyGroupId = z.infer<typeof EquivalencyGroupIdSchema>;

/** Schema for a credit amount in hundredths of a credit (350 = 3.5 credits). Never a float. */
const CreditsHundredthsSchema = z.number().int().nonnegative();

/**
 * Schema for a course.
 *
 * A course has exactly one credit form:
 * - fixed: `creditsHundredths` is set, and `minCreditsHundredths` and `maxCreditsHundredths`
 *   are `null`;
 * - variable: `creditsHundredths` is `null`, and both bounds are set with min ≤ max.
 */
export const CourseSchema = z
  .object({
    id: CourseIdSchema,
    tenantId: InstitutionIdSchema,
    /** Course identifier in the source system. Distinct from the internal {@link CourseId}. */
    sourceCourseId: z.string().min(1),
    /** Display text such as `MATH 101`. Labels can change, so this is never used as identity. */
    label: z.string().min(1),
    /** Fixed credit value in hundredths of a credit, or `null` for a variable-credit course. */
    creditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Lower credit bound in hundredths for a variable-credit course, or `null` when fixed. */
    minCreditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Upper credit bound in hundredths for a variable-credit course, or `null` when fixed. */
    maxCreditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Equivalency group this course belongs to, or `null` when it has no equivalents. */
    equivalencyGroupId: EquivalencyGroupIdSchema.nullable(),
  })
  // SAFETY: credit totals drive load and progress checks, so a course must state its credits
  // in exactly one unambiguous form rather than letting readers pick between two.
  .refine(
    (course) =>
      course.creditsHundredths === null
        ? course.minCreditsHundredths !== null && course.maxCreditsHundredths !== null
        : course.minCreditsHundredths === null && course.maxCreditsHundredths === null,
    {
      message:
        'A course has either creditsHundredths or both minCreditsHundredths and maxCreditsHundredths',
      path: ['creditsHundredths'],
    },
  )
  // SAFETY: an inverted range would let the engine count credits the course can never award.
  .refine(
    (course) =>
      course.minCreditsHundredths === null ||
      course.maxCreditsHundredths === null ||
      course.minCreditsHundredths <= course.maxCreditsHundredths,
    {
      message: 'minCreditsHundredths must not exceed maxCreditsHundredths',
      path: ['minCreditsHundredths'],
    },
  )
  .readonly();

/** A validated, immutable course. */
export type Course = z.infer<typeof CourseSchema>;

/** Raw input accepted by {@link createCourse}. */
export type CourseInput = z.input<typeof CourseSchema>;

/**
 * Creates a validated, immutable course.
 *
 * @param input - Raw course fields.
 * @returns The parsed course.
 * @throws {z.ZodError} When a field is invalid, the course mixes or omits credit forms, or its
 *   minimum credits exceed its maximum.
 */
export function createCourse(input: CourseInput): Course {
  return CourseSchema.parse(input);
}
