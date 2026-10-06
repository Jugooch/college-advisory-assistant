/**
 * @file Picks courses to check together, from the candidates the audit lists, with a credit
 * value for each variable-credit course. Submits with GET, so it works by keyboard and without
 * JavaScript.
 * @module @caa/web/features/course-checks/components/course-picker
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { MAX_COURSE_CHECK_COURSES } from '@caa/api-contract';

import { CourseChoice } from '@/shared/components/course-choice';
import type { CandidateCourse } from '@/shared/utils/candidate-courses';
import type { CourseLookup } from '@/shared/utils/course-display';
import type { CreditChoices } from '@/shared/utils/credit-choice';

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
  /** Catalog display entries by course ID. */
  readonly courses: CourseLookup;
  /** The typed credit values and their errors. */
  readonly credits: CreditChoices;
}

/**
 * Renders the course picker, or says why there is nothing to pick. Credit fields need the
 * record's catalog entries, so they are offered only when the candidate list loaded.
 *
 * @param props - The student, the candidates, the last selection, and the display entries.
 * @returns The picker section.
 */
export function CoursePicker({
  studentId,
  candidates,
  isCandidateListUnavailable,
  selectedCourseIds,
  selectionError,
  courses,
  credits,
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
            {isCandidateListUnavailable
              ? ' Credit values can be chosen once your record loads.'
              : ' For a course with a credit range, you can enter the credits you plan to take.'}
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
              courses={courses}
              credits={credits}
              isCreditChoiceOffered={!isCandidateListUnavailable}
            />
          ))}
        </fieldset>
        <button type="submit">Check these courses</button>
      </form>
    </section>
  );
}
