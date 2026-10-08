/**
 * @file The hidden fields every review form sends: the case, the sequence the page showed, and
 * the action. The sequence lets the API refuse a stale request instead of guessing.
 * @module @caa/web/features/advisor-cases/components/review-hidden-fields
 * @requirement FR-12
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import type { ReviewAction } from '../utils/review-case-state';
import {
  REVIEW_ACTION_FIELD,
  REVIEW_CASE_FIELD,
  REVIEW_SEQUENCE_FIELD,
} from '../utils/review-case-state';

/** Props for {@link ReviewHiddenFields}. */
export interface ReviewHiddenFieldsProps {
  readonly caseId: string;
  /** The case view's `lastSequence`. */
  readonly lastSequence: number;
  readonly action: ReviewAction;
}

/**
 * Renders the hidden inputs.
 *
 * @param props - The case, the sequence, and the action.
 * @returns The inputs.
 */
export function ReviewHiddenFields({
  caseId,
  lastSequence,
  action,
}: ReviewHiddenFieldsProps): ReactElement {
  return (
    <>
      <input type="hidden" name={REVIEW_CASE_FIELD} value={caseId} />
      <input type="hidden" name={REVIEW_SEQUENCE_FIELD} value={lastSequence} />
      <input type="hidden" name={REVIEW_ACTION_FIELD} value={action} />
    </>
  );
}
