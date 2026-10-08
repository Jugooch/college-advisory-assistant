/**
 * @file The submit button and the polite live region that reports a failed or pending submission.
 * The button uses `aria-disabled` while sending, so it keeps keyboard focus.
 * @module @caa/web/features/advisor-cases/components/submit-control
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import type { CreateCaseState } from '../utils/create-case-state';
import { CaseSubmitResult } from './case-submit-result';

/** Props for {@link SubmitControl}. */
export interface SubmitControlProps {
  readonly label: string;
  readonly isPending: boolean;
  readonly state: CreateCaseState;
  /** Link to the student's Help and cases page. */
  readonly casesHref: string;
}

/**
 * Renders the button and the live region. The confirmation is not here: it takes focus, so it
 * sits outside the region and is read once.
 *
 * @param props - The label, the pending flag, the state, and the Help and cases link.
 * @returns The submit control.
 */
export function SubmitControl({
  label,
  isPending,
  state,
  casesHref,
}: SubmitControlProps): ReactElement {
  return (
    <>
      <button
        type="submit"
        aria-disabled={isPending}
        onClick={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
      >
        {label}
      </button>
      <div role="status" aria-live="polite" aria-label="Submission result">
        {state.kind === 'idle' || state.kind === 'created' ? null : (
          <CaseSubmitResult state={state} casesHref={casesHref} />
        )}
        {isPending ? <p>Sending…</p> : null}
      </div>
    </>
  );
}
