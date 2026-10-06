/**
 * @file Converts course rows into domain objects.
 * @module @caa/db/mappers/course
 * @requirement FR-06
 */
import { type Course, createCourse } from '@caa/domain';

import type { CourseRow } from '../tables/course.table';

/**
 * Maps a database row to a validated domain object.
 *
 * @param row - Row read from the `course` table.
 * @returns The domain course.
 * @throws {z.ZodError} When the stored row violates the domain schema, for example a course
 *   with both fixed and variable credits.
 */
export function toCourse(row: CourseRow): Course {
  return createCourse({
    id: row.id,
    tenantId: row.tenantId,
    sourceCourseId: row.sourceCourseId,
    label: row.label,
    title: row.title,
    creditsHundredths: row.creditsHundredths,
    minCreditsHundredths: row.minCreditsHundredths,
    maxCreditsHundredths: row.maxCreditsHundredths,
    equivalencyGroupId: row.equivalencyGroupId,
    creditsIncludedInCourseId: row.creditsIncludedInCourseId,
    repeatableForCredit: row.repeatableForCredit
      ? {
          maxAttempts: row.repeatMaxAttempts,
          maxCreditsHundredths: row.repeatMaxCreditsHundredths,
        }
      : null,
  });
}
