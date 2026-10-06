/**
 * @file Names courses by their catalog code and title, from the display entries a response
 * carries. Display only; a course with no entry is named by its ID and said to have none.
 * @module @caa/web/shared/utils/course-display
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type AcademicSummaryResponse, ApiError, type CourseDisplay } from '@caa/api-contract';

/** Display entries by course ID. */
export type CourseLookup = ReadonlyMap<string, CourseDisplay>;

/** How one course is named on screen. */
export type CourseName =
  | { readonly kind: 'catalog'; readonly code: string; readonly title: string | null }
  /** No display entry: the ID is all that is known. */
  | { readonly kind: 'id-only'; readonly courseId: string };

/** Said after a course ID when there is no catalog entry to name it by. */
export const NO_CATALOG_DETAILS = 'no catalog details available';

/**
 * Indexes display entries by course ID. Earlier lists win, so a response's own entries can be
 * listed before another response's.
 *
 * @param lists - Display lists, each `undefined` when the response didn't send one.
 * @returns The lookup; empty when no list was sent.
 */
export function indexCourses(
  ...lists: readonly (readonly CourseDisplay[] | undefined)[]
): CourseLookup {
  const lookup = new Map<string, CourseDisplay>();
  for (const course of lists.flatMap((list) => list ?? [])) {
    if (!lookup.has(course.courseId)) {
      lookup.set(course.courseId, course);
    }
  }
  return lookup;
}

/**
 * Names one course.
 *
 * @param courseId - The course's ID.
 * @param lookup - Display entries by course ID.
 * @returns Its code and title, or its ID when it has no entry.
 */
export function nameCourse(courseId: string, lookup: CourseLookup): CourseName {
  const course = lookup.get(courseId);
  return course === undefined
    ? { kind: 'id-only', courseId }
    : { kind: 'catalog', code: course.code, title: course.title };
}

/**
 * Describes one course in running text.
 *
 * @param courseId - The course's ID.
 * @param lookup - Display entries by course ID.
 * @returns For example `DEMO-MATH 101 (Calculus I)`, `DEMO-MATH 101`, or
 *   `course <id> (no catalog details available)`.
 */
export function describeCourse(courseId: string, lookup: CourseLookup): string {
  const name = nameCourse(courseId, lookup);
  if (name.kind === 'id-only') {
    return `course ${name.courseId} (${NO_CATALOG_DETAILS})`;
  }
  return name.title === null ? name.code : `${name.code} (${name.title})`;
}

/**
 * Lists the summary's display entries.
 *
 * @param summary - The summary, or its error envelope.
 * @returns The entries by course ID; empty when the summary failed or sent none.
 */
export function summaryCourses(summary: AcademicSummaryResponse | ApiError): CourseLookup {
  return indexCourses(summary instanceof ApiError ? undefined : summary.courses);
}
