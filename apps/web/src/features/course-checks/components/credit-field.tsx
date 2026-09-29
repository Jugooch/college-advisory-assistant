/**
 * @file The credit value field of one variable-credit course. Blank means no value is chosen,
 * which the credit-load check reports as needing verification; no value is ever filled in.
 * @module @caa/web/features/course-checks/components/credit-field
 * @requirement FR-05
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { CourseLabel } from '@/shared/components/course-label';
import type { CourseLookup } from '@/shared/utils/course-display';
import { formatCredits } from '@/shared/utils/format-display';

import { creditFieldName } from '../utils/credit-choice';

/** Props for {@link CreditField}. */
export interface CreditFieldProps {
  readonly courseId: string;
  /** Lowest credits the catalog allows, in hundredths. */
  readonly minCreditsHundredths: number;
  /** Highest credits the catalog allows, in hundredths. */
  readonly maxCreditsHundredths: number;
  /** The last typed value, or an empty string. */
  readonly value: string;
  /** Why the last typed value was rejected, or null. */
  readonly error: string | null;
  /** Catalog display entries by course ID, to name the course in the label. */
  readonly courses: CourseLookup;
}

/**
 * Renders the labelled field, its hint, and its error, linked with `aria-describedby`.
 *
 * @param props - The course, its range, the last value, and its error.
 * @returns The field group.
 */
export function CreditField({
  courseId,
  minCreditsHundredths,
  maxCreditsHundredths,
  value,
  error,
  courses,
}: CreditFieldProps): ReactElement {
  const inputId = `pick-credits-${courseId}`;
  const describedBy = error === null ? `${inputId}-hint` : `${inputId}-hint ${inputId}-error`;
  return (
    <div className="choice__credits">
      <label htmlFor={inputId}>
        Credits for <CourseLabel courseId={courseId} courses={courses} />
      </label>
      <input
        id={inputId}
        name={creditFieldName(courseId)}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={value}
        aria-describedby={describedBy}
        aria-invalid={error !== null}
      />
      <p id={`${inputId}-hint`}>
        Enter {formatCredits(minCreditsHundredths)} to {formatCredits(maxCreditsHundredths)}. If you
        leave it blank, the credit load is shown as needing verification.
      </p>
      {error === null ? null : (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
