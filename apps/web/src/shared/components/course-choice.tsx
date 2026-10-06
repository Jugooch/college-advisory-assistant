/**
 * @file One candidate in the course picker: its checkbox, the requirements that list it, its
 * credits, and, for a variable-credit course, the credit value field.
 * @module @caa/web/shared/components/course-choice
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { CreditRuleKind } from '@caa/domain';

import type { CandidateCourse } from '@/shared/utils/candidate-courses';
import type { CourseLookup } from '@/shared/utils/course-display';
import { type CreditChoices, describeCreditRule } from '@/shared/utils/credit-choice';

import { CourseLabel } from './course-label';
import { CreditField } from './credit-field';

/** Props for {@link CourseChoice}. */
export interface CourseChoiceProps {
  readonly candidate: CandidateCourse;
  readonly isChecked: boolean;
  /** Catalog display entries by course ID. */
  readonly courses: CourseLookup;
  /** The typed credit values and their errors. */
  readonly credits: CreditChoices;
  /** Whether a variable-credit course offers its credit field. */
  readonly isCreditChoiceOffered: boolean;
}

/**
 * Describes where the audit lists a candidate and how many credits it carries.
 *
 * @param candidate - The candidate.
 * @param courses - Catalog display entries by course ID.
 * @returns The description text, with a leading space.
 */
function describeListing(candidate: CandidateCourse, courses: CourseLookup): string {
  const listed =
    candidate.requirementLabels.length === 0
      ? ' Chosen earlier; its requirements can’t be listed right now.'
      : ` Listed for: ${candidate.requirementLabels.join(', ')}.`;
  const rule = courses.get(candidate.courseId)?.credits;
  return rule === undefined ? listed : `${listed} ${describeCreditRule(rule)}.`;
}

/**
 * Renders one candidate row. Ids are prefixed `pick-` so they never collide with results.
 *
 * @param props - The candidate, whether it is checked, and its display entry and credit value.
 * @returns The choice row.
 */
export function CourseChoice({
  candidate,
  isChecked,
  courses,
  credits,
  isCreditChoiceOffered,
}: CourseChoiceProps): ReactElement {
  const { courseId } = candidate;
  const inputId = `pick-course-${courseId}`;
  const rule = courses.get(courseId)?.credits;
  return (
    <div className="choice">
      <input
        id={inputId}
        type="checkbox"
        name="course"
        value={courseId}
        defaultChecked={isChecked}
        aria-describedby={`${inputId}-listed`}
      />
      <label htmlFor={inputId}>
        <CourseLabel courseId={courseId} courses={courses} />
      </label>
      <span id={`${inputId}-listed`}>{describeListing(candidate, courses)}</span>
      {isCreditChoiceOffered && rule?.kind === CreditRuleKind.Variable ? (
        <CreditField
          courseId={courseId}
          minCreditsHundredths={rule.minCreditsHundredths}
          maxCreditsHundredths={rule.maxCreditsHundredths}
          value={credits.inputs.get(courseId) ?? ''}
          error={credits.errors.get(courseId) ?? null}
          courses={courses}
        />
      ) : null}
    </div>
  );
}
