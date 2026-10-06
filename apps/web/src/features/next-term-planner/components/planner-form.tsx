/**
 * @file The planner setup form: term, courses, and constraints, each marked preferred or
 * required. Submits with GET to the review step, so it works by keyboard and without
 * JavaScript. Nothing here searches.
 * @module @caa/web/features/next-term-planner/components/planner-form
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { MAX_SCHEDULE_OPTION_COURSES, type PlannableTerm } from '@caa/api-contract';

import { CourseChoice } from '@/shared/components/course-choice';
import type { CandidateCourse } from '@/shared/utils/candidate-courses';
import type { CourseLookup } from '@/shared/utils/course-display';
import type { CreditChoices } from '@/shared/utils/credit-choice';

import {
  plannerFieldId,
  type PlannerFormValues,
  PlannerStep,
  TIME_BLOCK_SLOTS,
} from '../utils/planner-fields';
import { CampusFieldset, CreditRangeFieldset, ModalityFieldset } from './limits-fieldsets';
import { TimeBlockFieldset } from './time-block-fieldset';

/** Props for {@link PlannerForm}. */
export interface PlannerFormProps {
  /** Internal student ID, submitted with the form. */
  readonly studentId: string;
  readonly values: PlannerFormValues;
  /** Field errors by query name. */
  readonly errors: ReadonlyMap<string, string>;
  readonly candidates: readonly CandidateCourse[];
  /** Whether the audit's candidates couldn't be listed because the record didn't load. */
  readonly isCandidateListUnavailable: boolean;
  /** Catalog display entries by course ID. */
  readonly courses: CourseLookup;
  readonly credits: CreditChoices;
  /** The plannable terms, or null when the list couldn't be loaded. */
  readonly terms: readonly PlannableTerm[] | null;
}

/**
 * Renders the term picker: a native select, so it works by keyboard and without JavaScript.
 *
 * @param props - The plannable terms, the chosen term, and its error.
 * @returns The field group.
 */
function TermField({
  terms,
  value,
  error,
}: {
  readonly terms: readonly PlannableTerm[];
  readonly value: string;
  readonly error: string | undefined;
}): ReactElement {
  const id = plannerFieldId('term');
  return (
    <>
      <label htmlFor={id}>Term</label>
      <select
        id={id}
        name="term"
        defaultValue={terms.some((term) => term.id === value) ? value : ''}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? `${id}-hint` : `${id}-hint ${id}-error`}
      >
        <option value="">Choose a term</option>
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.termCode} ({term.startsOn} to {term.endsOn})
          </option>
        ))}
      </select>
      <p id={`${id}-hint`}>
        These are the terms you can set up a search for. Choosing one does not register you.
      </p>
      {error === undefined ? null : (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Says no term can be offered, in place of the picker and the rest of the form.
 *
 * @param props - Whether the list failed to load rather than being empty.
 * @returns The notice.
 */
function NoTerms({ isUnavailable }: { readonly isUnavailable: boolean }): ReactElement {
  return (
    <section className="notice" aria-labelledby="planner-no-terms-heading">
      <h2 id="planner-no-terms-heading">No term to plan for yet</h2>
      <p>
        {isUnavailable
          ? 'The terms you can plan for couldn’t be listed right now.'
          : 'There is no term you can plan for right now.'}
      </p>
      <p>
        <strong>Next step:</strong>{' '}
        {isUnavailable
          ? 'Try again later, or ask your advisor which term to plan for.'
          : 'Ask your advisor which term to plan for.'}
      </p>
    </section>
  );
}

/**
 * Renders the course choices, or says why there is nothing to choose.
 *
 * @param props - The form's props.
 * @returns The courses fieldset.
 */
function CourseChoices({
  values,
  errors,
  candidates,
  isCandidateListUnavailable,
  courses,
  credits,
}: PlannerFormProps): ReactElement {
  const error = errors.get('course');
  return (
    <fieldset
      id="planner-course"
      tabIndex={-1}
      aria-describedby={error === undefined ? undefined : 'planner-course-error'}
    >
      <legend>Courses to schedule</legend>
      <p id="planner-course-hint">
        Choose 1 to {MAX_SCHEDULE_OPTION_COURSES} courses. All of them are scheduled together.
      </p>
      {candidates.length === 0 ? (
        <p>
          {isCandidateListUnavailable
            ? 'Candidate courses can’t be listed until your record loads.'
            : 'Your audit doesn’t list any candidate courses.'}
        </p>
      ) : null}
      {error === undefined ? null : (
        <p id="planner-course-error" className="field-error">
          {error}
        </p>
      )}
      {candidates.map((candidate) => (
        <CourseChoice
          key={candidate.courseId}
          candidate={candidate}
          isChecked={values.courseIds.includes(candidate.courseId)}
          courses={courses}
          credits={credits}
          isCreditChoiceOffered={!isCandidateListUnavailable}
        />
      ))}
    </fieldset>
  );
}

/**
 * Renders the form.
 *
 * @param props - The student, the typed values, the errors, and the course data.
 * @returns The form.
 */
export function PlannerForm(props: PlannerFormProps): ReactElement {
  const { studentId, values, errors, terms } = props;
  if (terms === null || terms.length === 0) {
    return <NoTerms isUnavailable={terms === null} />;
  }
  const [block1, block2, block3] = TIME_BLOCK_SLOTS;
  return (
    <form action="/next-term-planner" method="get">
      <input type="hidden" name="studentId" value={studentId} />
      <TermField terms={terms} value={values.termId} error={errors.get('term')} />
      <CourseChoices {...props} />
      <h2>Constraints</h2>
      <p>
        Each constraint is a preference unless you mark it required. You review them all before
        anything is searched.
      </p>
      <TimeBlockFieldset
        slot={block1}
        number={1}
        block={values.timeBlocks[block1]}
        errors={errors}
      />
      <TimeBlockFieldset
        slot={block2}
        number={2}
        block={values.timeBlocks[block2]}
        errors={errors}
      />
      <TimeBlockFieldset
        slot={block3}
        number={3}
        block={values.timeBlocks[block3]}
        errors={errors}
      />
      <CreditRangeFieldset values={values} errors={errors} />
      <ModalityFieldset values={values} errors={errors} />
      <CampusFieldset values={values} errors={errors} />
      <button type="submit" name="step" value={PlannerStep.Review}>
        Review constraints
      </button>
    </form>
  );
}
