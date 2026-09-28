/**
 * @file Reads the course check page's query: the student, and which courses were selected.
 * @module @caa/web/features/course-checks/utils/course-check-query
 * @requirement FR-09
 * @see docs/standards/09-errors-logging-and-security.md
 */
import {
  type CourseChecksRequest,
  CourseChecksRequestSchema,
  MAX_COURSE_CHECK_COURSES,
} from '@caa/api-contract';
import { CourseIdSchema } from '@caa/domain';

import { readStudentIdQuery, type StudentIdQuery } from '@/shared/utils/student-id-query';

/** Search params as Next passes them. */
export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** What the course selection in the query amounts to. */
export type CourseSelection =
  /** The picker hasn't been submitted yet. */
  | { readonly kind: 'not-submitted' }
  /** The picker was submitted with nothing selected. */
  | { readonly kind: 'none-selected' }
  /** More courses than one check allows. */
  | { readonly kind: 'too-many'; readonly count: number }
  /** A selected value isn't a course ID, for example from an edited link. */
  | { readonly kind: 'invalid-course' }
  | { readonly kind: 'valid'; readonly request: CourseChecksRequest };

/** The parsed query. */
export interface CourseCheckQuery {
  readonly student: StudentIdQuery;
  /** The selected values, once each, in submitted order. Not yet validated. */
  readonly selectedCourseIds: readonly string[];
  readonly selection: CourseSelection;
}

/**
 * Decides what the selected values amount to.
 *
 * @param courseIds - The distinct selected values.
 * @param isSubmitted - Whether the picker form was submitted.
 * @returns The selection.
 */
function toSelection(courseIds: readonly string[], isSubmitted: boolean): CourseSelection {
  if (courseIds.length === 0) {
    return { kind: isSubmitted ? 'none-selected' : 'not-submitted' };
  }
  if (!courseIds.every((courseId) => CourseIdSchema.safeParse(courseId).success)) {
    return { kind: 'invalid-course' };
  }
  if (courseIds.length > MAX_COURSE_CHECK_COURSES) {
    return { kind: 'too-many', count: courseIds.length };
  }
  const parsed = CourseChecksRequestSchema.safeParse({ courseIds });
  return parsed.success ? { kind: 'valid', request: parsed.data } : { kind: 'invalid-course' };
}

/**
 * Reads the course check page's query.
 *
 * @param query - The page's search params.
 * @returns The student, the selected values, and what the selection amounts to.
 */
export function readCourseCheckQuery(query: SearchParams): CourseCheckQuery {
  const selectedCourseIds = [...new Set(query.course === undefined ? [] : [query.course].flat())];
  return {
    student: readStudentIdQuery(query.studentId),
    selectedCourseIds,
    selection: toSelection(selectedCourseIds, query.submitted !== undefined),
  };
}

/**
 * Describes a rejected selection for the picker's error message.
 *
 * @param selection - The selection.
 * @returns The message, or null when there is nothing to report.
 */
export function describeSelectionError(selection: CourseSelection): string | null {
  switch (selection.kind) {
    case 'none-selected':
      return 'Choose at least one course.';
    case 'too-many':
      return `Choose at most ${String(MAX_COURSE_CHECK_COURSES)} courses. You chose ${String(selection.count)}.`;
    case 'invalid-course':
      return 'One of the selected values isn’t a course ID. Choose courses from the list.';
    case 'not-submitted':
    case 'valid':
      return null;
  }
}
