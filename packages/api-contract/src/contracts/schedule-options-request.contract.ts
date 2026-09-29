/**
 * @file Request body for schedule options: the term, the required courses, credits, and constraints.
 * @module @caa/api-contract/contracts/schedule-options-request
 * @requirement FR-01
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { CourseIdSchema, ScheduleConstraintSetSchema, TermIdSchema } from '@caa/domain';

import { CreditSelectionSchema } from './course-checks-request.contract';

/** Most courses one schedule-options request may name (ADR-0010 §2). */
export const MAX_SCHEDULE_OPTION_COURSES = 8;

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
 * Request body for `POST /v1/students/:studentId/schedule-options`.
 *
 * SECURITY: strict. The body names a term, courses, credit choices, and constraints only;
 * tenant, user, and role come from the session, so any other field, such as `tenantId`, is
 * rejected (FR-01).
 */
export const ScheduleOptionsRequestSchema = z
  .strictObject({
    /** The term to schedule, from the tenant's term calendar. */
    termId: TermIdSchema,
    /**
     * The courses to schedule: 1 to 8 distinct courses, all required. The solver picks one
     * section bundle for each and never drops or adds a course (ADR-0010 §2).
     */
    courseIds: z.array(CourseIdSchema).min(1).max(MAX_SCHEDULE_OPTION_COURSES).readonly(),
    /**
     * Chosen credit values for variable-credit courses, at most one per course, each naming a
     * course in `courseIds`, as in course checks. A course with no entry has no chosen value,
     * which the credit-load check reports as UNKNOWN, never as an assumed value. Empty when no
     * value is chosen.
     */
    creditSelections: z.array(CreditSelectionSchema).max(MAX_SCHEDULE_OPTION_COURSES).readonly(),
    /** The student's hard constraints and ranked preferences, in the order stated. */
    constraints: ScheduleConstraintSetSchema,
  })
  .refine((body) => isDistinct(body.courseIds), {
    message: 'courseIds must not repeat a course',
    path: ['courseIds'],
  })
  // SAFETY: two values for one course would let the server pick which credits count
  // (planning/08 §Candidate formation and allocation: do not assume credit values).
  .refine((body) => isDistinct(body.creditSelections.map((selection) => selection.courseId)), {
    message: 'creditSelections must not repeat a course',
    path: ['creditSelections'],
  })
  .refine(
    (body) =>
      body.creditSelections.every((selection) => body.courseIds.includes(selection.courseId)),
    { message: 'Each creditSelections course must be in courseIds', path: ['creditSelections'] },
  )
  .readonly();

/** Request body for `POST /v1/students/:studentId/schedule-options`. */
export type ScheduleOptionsRequest = z.infer<typeof ScheduleOptionsRequestSchema>;
