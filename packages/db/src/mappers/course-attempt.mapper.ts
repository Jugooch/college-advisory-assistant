/**
 * @file Converts course attempt rows into domain objects.
 * @module @caa/db/mappers/course-attempt
 * @requirement FR-05
 */
import { type CourseAttempt, createCourseAttempt, type Grade, GradeSchema } from '@caa/domain';

import type { CourseAttemptRow } from '../tables/course-attempt.table';

/**
 * Rebuilds the grade from its scheme and value columns.
 *
 * @param row - Row read from the `course_attempt` table.
 * @returns The grade, or null when both columns are null.
 * @throws {z.ZodError} When only one column is set or the value isn't valid for the scheme.
 */
function toGrade(row: CourseAttemptRow): Grade | null {
  // SAFETY: only both-null means "no grade". Half a grade is parsed so it fails loudly instead
  // of reading as ungraded.
  if (row.gradeScheme === null && row.gradeValue === null) {
    return null;
  }
  return GradeSchema.parse({ scheme: row.gradeScheme, value: row.gradeValue });
}

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `course_attempt` table.
 * @returns The domain course attempt.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toCourseAttempt(row: CourseAttemptRow): CourseAttempt {
  return createCourseAttempt({
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentId,
    courseId: row.courseId,
    sourceAttemptId: row.sourceAttemptId,
    termCode: row.termCode,
    status: row.status,
    grade: toGrade(row),
    creditsEarnedHundredths: row.creditsEarnedHundredths,
  });
}
