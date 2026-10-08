/**
 * @file The resolution choices of the resolve form: a labelled group of radio buttons with an
 * error that is linked and shown when none is chosen. No option says a request was approved.
 * @module @caa/web/features/advisor-cases/components/resolution-options
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement, Ref } from 'react';

import { CaseResolution } from '@caa/domain';

import { REVIEW_RESOLUTION_FIELD } from '../utils/review-case-state';
import { describeResolutionOption } from '../utils/review-wording';

/** Shown under the options when the form is submitted without one chosen. */
export const RESOLUTION_REQUIRED_MESSAGE = 'Choose how you resolved this case.';

const OPTIONS = [
  CaseResolution.PlanReviewed,
  CaseResolution.StudentActionNeeded,
  CaseResolution.ReferredOutsideApp,
] as const;

/** Props for {@link ResolutionOptions}. */
export interface ResolutionOptionsProps {
  /** The chosen resolution, or `null` before one is chosen. */
  readonly selected: CaseResolution | null;
  readonly onSelect: (option: CaseResolution) => void;
  /** IDs of the elements that describe the group: the disclaimer, and the error when shown. */
  readonly describedBy: string;
  /** ID for the error paragraph, or `null` when there is no error. */
  readonly errorId: string | null;
  /** Lets the form move focus to the first option when it rejects a submit. */
  readonly firstOptionRef: Ref<HTMLInputElement>;
}

/**
 * Renders the group.
 *
 * @param props - The choice, its handler, the description IDs, the error ID, and the focus ref.
 * @returns The fieldset.
 */
export function ResolutionOptions({
  selected,
  onSelect,
  describedBy,
  errorId,
  firstOptionRef,
}: ResolutionOptionsProps): ReactElement {
  return (
    <fieldset aria-describedby={describedBy}>
      <legend>How did you resolve it?</legend>
      {OPTIONS.map((option, index) => (
        <p key={option}>
          <label>
            <input
              type="radio"
              name={REVIEW_RESOLUTION_FIELD}
              value={option}
              ref={index === 0 ? firstOptionRef : undefined}
              checked={selected === option}
              onChange={() => {
                onSelect(option);
              }}
            />{' '}
            {describeResolutionOption(option)}
          </label>
        </p>
      ))}
      {errorId === null ? null : (
        <p id={errorId} className="field-error">
          {RESOLUTION_REQUIRED_MESSAGE}
        </p>
      )}
    </fieldset>
  );
}
