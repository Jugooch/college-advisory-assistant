/**
 * @file The course check screen: any error notices, the results, and the course picker.
 * @module @caa/web/features/course-checks/components/course-check-screen
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { ApiErrorNotice } from '@/shared/components/api-error-notice';

import type { CourseCheckView } from '../utils/course-check-view';
import { CourseCheckResults } from './course-check-results';
import { CoursePicker } from './course-picker';

/** Props for {@link CourseCheckScreen}. */
export interface CourseCheckScreenProps {
  /** Internal student ID, submitted with the picker. */
  readonly studentId: string;
  readonly view: CourseCheckView;
  /** Courses selected in the last submission, checked again. */
  readonly selectedCourseIds: readonly string[];
}

/**
 * Renders the screen from its planned view.
 *
 * @param props - The student, the view, and the last selection.
 * @returns The screen content.
 */
export function CourseCheckScreen({
  studentId,
  view,
  selectedCourseIds,
}: CourseCheckScreenProps): ReactElement {
  return (
    <>
      {view.resultError === null ? null : (
        <ApiErrorNotice error={view.resultError} headingId="check-error-heading" />
      )}
      {view.result === null ? null : (
        <CourseCheckResults result={view.result} courses={view.courses} />
      )}
      {view.summaryError === null ? null : (
        <ApiErrorNotice error={view.summaryError} headingId="summary-error-heading" />
      )}
      <CoursePicker
        studentId={studentId}
        candidates={view.candidates}
        isCandidateListUnavailable={view.isCandidateListUnavailable}
        selectedCourseIds={selectedCourseIds}
        selectionError={view.selectionError}
        courses={view.courses}
        credits={view.credits}
      />
    </>
  );
}
