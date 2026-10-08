/**
 * @file The confirmation after a save. It sits outside the live region and takes focus, so a
 * screen reader reads it once.
 * @module @caa/web/features/plan-drafts/components/save-draft-confirmation
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement, Ref } from 'react';

import { PlanFreshness } from '@/shared/components/plan-freshness';
import { Timestamp } from '@/shared/components/timestamp';

import {
  RESULT_UNAVAILABLE_MESSAGE,
  SAVED_MESSAGE,
  type SaveDraftState,
} from '../utils/save-draft-state';

/** Props for {@link SaveDraftConfirmation}. */
export interface SaveDraftConfirmationProps {
  readonly state: Extract<SaveDraftState, { readonly kind: 'saved' }>;
  /** Link to the student's My plans page. */
  readonly plansHref: string;
  /** Focus target, so keyboard and screen reader users land on the confirmation. */
  readonly confirmationRef: Ref<HTMLDivElement>;
}

/**
 * Renders the saved revision, its freshness, and a link to My plans. A draft is a plan, never a
 * registration.
 *
 * @param props - The saved state, the My plans link, and the focus ref.
 * @returns The confirmation.
 */
export function SaveDraftConfirmation({
  state,
  plansHref,
  confirmationRef,
}: SaveDraftConfirmationProps): ReactElement {
  return (
    <div className="notice" tabIndex={-1} ref={confirmationRef}>
      <p>
        <strong>{SAVED_MESSAGE}</strong> Revision {state.revision}, saved{' '}
        <Timestamp iso={state.savedAt} />.
      </p>
      <PlanFreshness freshness={state.freshness} />
      {state.isResultUnavailable ? <p>{RESULT_UNAVAILABLE_MESSAGE}</p> : null}
      <p>
        <Link href={plansHref}>Open My plans</Link>
      </p>
    </div>
  );
}
