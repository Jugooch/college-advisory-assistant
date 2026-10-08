/**
 * @file What a failed save attempt produced: the changed-options message, the rejected-form message, or
 * the API's own error. It sits inside the form's polite live region.
 * @module @caa/web/features/plan-drafts/components/save-draft-result
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ReactElement } from 'react';

import { describeError } from '@/shared/utils/error-code-wording';

import { CONFLICT_MESSAGE, REJECTED_MESSAGE, type SaveDraftState } from '../utils/save-draft-state';

/** Props for {@link SaveDraftResult}. */
export interface SaveDraftResultProps {
  readonly state: Exclude<SaveDraftState, { readonly kind: 'idle' | 'saved' }>;
  /** Refreshes the page's options after a conflict. */
  readonly onRefresh: () => void;
}

/**
 * Renders one save outcome.
 *
 * @param props - The state and the refresh handler.
 * @returns The outcome section.
 */
export function SaveDraftResult({ state, onRefresh }: SaveDraftResultProps): ReactElement {
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
