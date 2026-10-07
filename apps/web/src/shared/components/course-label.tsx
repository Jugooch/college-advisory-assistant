/**
 * @file Names one course by its catalog code and title, or by its ID when it has no entry.
 * @module @caa/web/shared/components/course-label
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import {
  type CourseLookup,
  nameCourse,
  NO_CATALOG_DETAILS,
  TITLE_NOT_AVAILABLE,
} from '@/shared/utils/course-display';

/** Props for {@link CourseLabel}. */
export interface CourseLabelProps {
  readonly courseId: string;
  /** Display entries by course ID. */
  readonly courses: CourseLookup;
}

/**
 * Renders the course's name inline.
 *
 * @param props - The course ID and the display entries.
 * @returns For example `DEMO-MATH 101 (Calculus I)`, or `Course <id> (no catalog details
 *   available)`.
 */
export function CourseLabel({ courseId, courses }: CourseLabelProps): ReactElement {
  const name = nameCourse(courseId, courses);
  if (name.kind === 'id-only') {
    return (
      <>
        Course <code>{name.courseId}</code> ({NO_CATALOG_DETAILS})
      </>
    );
  }
  return <>{`${name.code} (${name.title ?? TITLE_NOT_AVAILABLE})`}</>;
}
