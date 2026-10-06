/**
 * @file The review step: every constraint in words with its strength, confirmed before any
 * search. Both buttons keep the typed values, so a retry or an edit loses nothing.
 * @module @caa/web/features/next-term-planner/components/review-step
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ReviewedConstraint } from '../utils/constraint-wording';
import { type PlannerFormValues, PlannerStep } from '../utils/planner-fields';
import { HiddenValues } from './hidden-values';

/** Props for {@link ReviewStep}. */
export interface ReviewStepProps {
  readonly studentId: string;
  readonly values: PlannerFormValues;
  readonly constraints: readonly ReviewedConstraint[];
  /** What the confirm button says: the first search or a retry. */
  readonly isRetry: boolean;
}

/**
 * Renders the constraint list and the confirm and edit buttons.
 *
 * @param props - The student, the typed values, and the constraints in words.
 * @returns The review section.
 */
export function ReviewStep({
  studentId,
  values,
  constraints,
  isRetry,
}: ReviewStepProps): ReactElement {
  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading">Review your constraints</h2>
      <p>
        Required constraints remove every schedule that breaks them. Preferences are weighed, in
        priority order, and may not all be met.
      </p>
      {constraints.length === 0 ? (
        <p>You stated no constraints, so every schedule for your courses is allowed.</p>
      ) : (
        <ul className="constraint-list">
          {constraints.map((constraint) => (
            <li key={`${constraint.statement}-${constraint.strength}`}>
              <strong>{constraint.strength}:</strong> {constraint.statement}
            </li>
          ))}
        </ul>
      )}
      <form action="/next-term-planner" method="get">
        <input type="hidden" name="studentId" value={studentId} />
        <HiddenValues values={values} />
        <button type="submit" name="step" value={PlannerStep.Search}>
          {isRetry ? 'Try the search again' : 'Confirm and find schedules'}
        </button>
        <button type="submit" name="step" value={PlannerStep.Edit}>
          Change constraints
        </button>
      </form>
    </section>
  );
}
