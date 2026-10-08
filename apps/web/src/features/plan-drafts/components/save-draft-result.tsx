/**
 * @file What a save attempt produced: the confirmation, the changed-options message, or the API's
 * own error. It sits inside the form's polite live region.
 * @module @caa/web/features/plan-drafts/components/save-draft-result
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import Link from 'next/link';
import type { ReactElement, Ref } from 'react';

import { Timestamp } from '@/shared/components/timestamp';
import { describeError } from '@/shared/utils/error-code-wording';

import {
  CONFLICT_MESSAGE,
  REJECTED_MESSAGE,
  RESULT_UNAVAILABLE_MESSAGE,
  SAVED_MESSAGE,
  type SaveDraftState,
} from '../utils/save-draft-state';
import { PlanFreshness } from './plan-freshness';

/** Props for {@link SaveDraftResult}. */
export interface SaveDraftResultProps {
  readonly state: Exclude<SaveDraftState, { readonly kind: 'idle' }>;
  /** Link to the student's My plans page. */
  readonly plansHref: string;
  /** Focus target for the confirmation, so keyboard and screen reader users land on it. */
  readonly confirmationRef: Ref<HTMLDivElement>;
  /** Refreshes the page's options after a conflict. */
  readonly onRefresh: () => void;
}

/**
 * Renders one save outcome.
 *
 * @param props - The state, the My plans link, the focus ref, and the refresh handler.
 * @returns The outcome section.
 */
export function SaveDraftResult({
  state,
  plansHref,
  confirmationRef,
  onRefresh,
}: SaveDraftResultProps): ReactElement {
  if (state.kind === 'saved') {
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
  if (state.kind === 'conflict') {
    return (
      <div className="notice notice--caution">
        <p>{CONFLICT_MESSAGE}</p>
        <button type="button" onClick={onRefresh}>
          Refresh options
        </button>
      </div>
    );
  }
  if (state.kind === 'rejected') {
    return (
      <div className="notice notice--problem">
        <p>{REJECTED_MESSAGE}</p>
        <button type="button" onClick={onRefresh}>
          Refresh options
        </button>
      </div>
    );
  }
  const wording = describeError(state.code);
  return (
    <div className="notice notice--problem">
      <p>
        <strong>{wording.heading}.</strong> {state.message}
      </p>
      <p>{wording.nextStep}</p>
      {state.requestId === null ? null : (
        <p>
          Support reference: <code>{state.requestId}</code>
        </p>
      )}
    </div>
  );
}
