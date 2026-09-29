/**
 * @file Lists the courses the audit names for one requirement, by catalog code and title.
 * @module @caa/web/features/academic-summary/components/candidate-course-list
 * @requirement FR-04
 * @requirement FR-10
 */
import type { ReactElement } from 'react';

import { CourseLabel } from '@/shared/components/course-label';
import type { CourseLookup } from '@/shared/utils/course-display';

/** Props for {@link CandidateCourseList}. */
export interface CandidateCourseListProps {
  /** The requirement's candidate courses, in audit order. */
  readonly courseIds: readonly string[];
  /** Catalog display entries by course ID. */
  readonly courses: CourseLookup;
}

/**
 * Renders the candidates as a list, or says the audit lists none.
 *
 * @param props - The candidate IDs and the display entries.
 * @returns The list, or the text `None`.
 */
export function CandidateCourseList({
  courseIds,
  courses,
}: CandidateCourseListProps): ReactElement {
  if (courseIds.length === 0) {
    return <>None</>;
  }
  return (
    <ul>
      {courseIds.map((courseId) => (
        <li key={courseId}>
          <CourseLabel courseId={courseId} courses={courses} />
        </li>
      ))}
    </ul>
  );
}
