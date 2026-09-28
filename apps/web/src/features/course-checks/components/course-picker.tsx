/**
 * @file Picks courses to check together, from the candidates the audit lists. Submits with GET,
 * so it works by keyboard and without JavaScript.
 * @module @caa/web/features/course-checks/components/course-picker
 * @requirement FR-04
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { MAX_COURSE_CHECK_COURSES } from '@caa/api-contract';

import type { CandidateCourse } from '../utils/candidate-courses';

/** Props for {@link CoursePicker}. */
export interface CoursePickerProps {
  /** Internal student ID, submitted with the form. */
  readonly studentId: string;
  readonly candidates: readonly CandidateCourse[];
  /** Courses selected in the last submission, checked again. */
  readonly selectedCourseIds: readonly string[];
  /** Whether the last submission's selection was rejected (none, or too many). */
  readonly hasSelectionError: boolean;
}

/**
 * Renders the course picker, or says there is nothing to pick.
 *
 * @param props - The student, the candidates, and the last selection.
 * @returns The picker section.
 */
export function CoursePicker({
  studentId,
  candidates,
  selectedCourseIds,
  hasSelectionError,
}: CoursePickerProps): ReactElement {
  if (candidates.length === 0) {
    return (
      <section aria-labelledby="picker-heading">
        <h2 id="picker-heading">Choose courses</h2>
        <p>Your audit doesn’t list any candidate courses to check.</p>
        <p>
          <strong>Next step:</strong> Ask your advisor which courses to plan for.
        </p>
      </section>
    );
  }
  const describedBy = hasSelectionError ? 'picker-hint picker-error' : 'picker-hint';
  return (
    <section aria-labelledby="picker-heading">
      <h2 id="picker-heading">Choose courses</h2>
      <form action="/course-checks" method="get">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="submitted" value="1" />
        <fieldset aria-describedby={describedBy}>
          <legend>Courses your audit lists for your requirements</legend>
          <p id="picker-hint">
            Choose 1 to {MAX_COURSE_CHECK_COURSES} courses. They are checked together, as one set.
          </p>
          {hasSelectionError ? (
            <p id="picker-error" className="field-error" role="alert">
              Choose between 1 and {MAX_COURSE_CHECK_COURSES} courses.
            </p>
          ) : null}
          {candidates.map(({ courseId, requirementLabels }) => (
            <div key={courseId} className="choice">
              <input
                id={`course-${courseId}`}
                type="checkbox"
                name="course"
                value={courseId}
                defaultChecked={selectedCourseIds.includes(courseId)}
                aria-describedby={`course-${courseId}-listed`}
              />
              <label htmlFor={`course-${courseId}`}>
                Course <code>{courseId}</code>
              </label>
              <span id={`course-${courseId}-listed`}>
                {' '}
                Listed for: {requirementLabels.join(', ')}
              </span>
            </div>
          ))}
        </fieldset>
        <button type="submit">Check these courses</button>
      </form>
    </section>
  );
}
