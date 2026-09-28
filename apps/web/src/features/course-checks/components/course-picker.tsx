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
  /** Whether the audit's candidates couldn't be listed because the record didn't load. */
  readonly isCandidateListUnavailable: boolean;
  /** Courses selected in the last submission, checked again. */
  readonly selectedCourseIds: readonly string[];
  /** Why the last submission's selection was rejected, or null. */
  readonly selectionError: string | null;
}

/**
 * Renders one candidate checkbox. Ids are prefixed `pick-` so they never collide with results.
 *
 * @param props - The candidate and whether it is checked.
 * @returns The choice row.
 */
function CourseChoice(props: {
  readonly candidate: CandidateCourse;
  readonly isChecked: boolean;
}): ReactElement {
  const { courseId, requirementLabels } = props.candidate;
  const inputId = `pick-course-${courseId}`;
  return (
    <div className="choice">
      <input
        id={inputId}
        type="checkbox"
        name="course"
        value={courseId}
        defaultChecked={props.isChecked}
        aria-describedby={`${inputId}-listed`}
      />
      <label htmlFor={inputId}>
        Course <code>{courseId}</code>
      </label>
      <span id={`${inputId}-listed`}>
        {requirementLabels.length === 0
          ? ' Checked earlier; its requirements can’t be listed right now.'
          : ` Listed for: ${requirementLabels.join(', ')}`}
      </span>
    </div>
  );
}

/**
 * Renders the course picker, or says why there is nothing to pick.
 *
 * @param props - The student, the candidates, and the last selection.
 * @returns The picker section.
 */
export function CoursePicker({
  studentId,
  candidates,
  isCandidateListUnavailable,
  selectedCourseIds,
  selectionError,
}: CoursePickerProps): ReactElement {
  if (candidates.length === 0) {
    return (
      <section aria-labelledby="picker-heading">
        <h2 id="picker-heading">Choose courses</h2>
        <p>
          {isCandidateListUnavailable
            ? 'Candidate courses can’t be listed until your record loads.'
            : 'Your audit doesn’t list any candidate courses to check.'}
        </p>
        <p>
          <strong>Next step:</strong> Ask your advisor which courses to plan for.
        </p>
      </section>
    );
  }
  const describedBy = selectionError === null ? 'picker-hint' : 'picker-hint picker-error';
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
          {selectionError === null ? null : (
            <p id="picker-error" className="field-error" role="alert">
              {selectionError}
            </p>
          )}
          {candidates.map((candidate) => (
            <CourseChoice
              key={candidate.courseId}
              candidate={candidate}
              isChecked={selectedCourseIds.includes(candidate.courseId)}
            />
          ))}
        </fieldset>
        <button type="submit">Check these courses</button>
      </form>
    </section>
  );
}
