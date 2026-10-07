/**
 * @file Request body for checking a candidate course set: the courses and chosen credit values.
 * @module @caa/api-contract/contracts/course-checks-request
 * @requirement FR-01
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { CourseIdSchema, CreditSelectionSchema } from '@caa/domain';

/** Most courses one course-checks request may name. */
export const MAX_COURSE_CHECK_COURSES = 12;

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
 * Request body for `POST /v1/students/:studentId/course-checks`.
 *
 * SECURITY: strict. The body names courses and credit choices only; tenant, user, and role come
 * from the session, so any other field, such as `tenantId`, is rejected (FR-01).
 */
export const CourseChecksRequestSchema = z
  .strictObject({
    /** The candidate set: 1 to 12 distinct courses, checked together. */
    courseIds: z.array(CourseIdSchema).min(1).max(MAX_COURSE_CHECK_COURSES).readonly(),
    /**
     * Chosen credit values for variable-credit courses, at most one per course, each naming a
     * course in `courseIds`. Omitted or missing for a course means no value is chosen, which the
     * credit-load check reports as UNKNOWN, never as an assumed value.
     */
    creditSelections: z.array(CreditSelectionSchema).readonly().optional(),
  })
  .refine((body) => isDistinct(body.courseIds), {
    message: 'courseIds must not repeat a course',
    path: ['courseIds'],
  })
  // SAFETY: two values for one course would let the server pick which credits count
  // (planning/08 §Candidate formation and allocation: do not assume credit values).
  .refine(
    (body) => isDistinct((body.creditSelections ?? []).map((selection) => selection.courseId)),
    { message: 'creditSelections must not repeat a course', path: ['creditSelections'] },
  )
  .refine(
    (body) =>
      (body.creditSelections ?? []).every((selection) =>
        body.courseIds.includes(selection.courseId),
      ),
    { message: 'Each creditSelections course must be in courseIds', path: ['creditSelections'] },
  )
  .readonly();

/** Request body for `POST /v1/students/:studentId/course-checks`. */
export type CourseChecksRequest = z.infer<typeof CourseChecksRequestSchema>;
