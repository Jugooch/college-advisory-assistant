/**
 * @file What the screen says after an action went through, after a race with another reviewer, or
 * after the case became unavailable. Each says what happened and what to do next. It sits outside
 * any live region: the review panel moves focus to its heading, which points here, so the message
 * is read once.
 * @module @caa/web/features/advisor-cases/components/review-outcome
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { ReviewCaseState } from '../utils/review-case-state';
import {
  CASE_CHANGED_EXPLANATION,
  CASE_CHANGED_HEADING,
  CASE_CHANGED_NEXT_STEP,
  describeReviewDone,
  NO_ACCESS_EXPLANATION,
  NO_ACCESS_NEXT_STEP,
} from '../utils/review-wording';

/** Props for {@link ReviewOutcome}. */
export interface ReviewOutcomeProps {
  /** The element ID the heading's `aria-describedby` points at. */
  readonly id: string;
  readonly state: ReviewCaseState;
}

/**
 * Renders the outcome, or nothing for a state it doesn't explain.
 *
 * @param props - The ID to point at and the state.
 * @returns The outcome message, or `null`.
 */
export function ReviewOutcome({ id, state }: ReviewOutcomeProps): ReactElement | null {
  if (state.kind === 'done') {
    const done = describeReviewDone(state.action);
    return (
      <div id={id} className="notice">
        <p>{done.message}</p>
        <p>{done.nextStep}</p>
        <p>
          <Link href="/advisor/queue">Back to the review queue</Link>
        </p>
      </div>
    );
  }
  if (state.kind === 'changed') {
    return (
      <div id={id} className="notice notice--caution">
        <p>
          <strong>{CASE_CHANGED_HEADING}.</strong> {CASE_CHANGED_EXPLANATION}
        </p>
        <p>{CASE_CHANGED_NEXT_STEP}</p>
      </div>
    );
  }
  if (state.kind === 'gone') {
    return (
      <div id={id} className="notice notice--problem">
        <p>{NO_ACCESS_EXPLANATION}</p>
        <p>{NO_ACCESS_NEXT_STEP}</p>
        <p>
          <Link href="/advisor/queue">Back to the review queue</Link>
        </p>
      </div>
    );
  }
  return null;
}
