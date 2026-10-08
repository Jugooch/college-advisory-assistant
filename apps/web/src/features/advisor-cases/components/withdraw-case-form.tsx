'use client';
/**
 * @file The withdraw control for one case. It is offered only when the case view lists `WITHDRAW`
 * in `allowedActions`; this component never decides that itself. The result is reported in a
 * polite live region, and focus stays where the student left it.
 * @module @caa/web/features/advisor-cases/components/withdraw-case-form
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { type ReactElement, useActionState } from 'react';

import { describeError } from '@/shared/utils/error-code-wording';

import { CASE_CHANGED, FORM_REJECTED } from '../utils/case-wording';
import {
  IDLE_WITHDRAW_STATE,
  WITHDRAW_CASE_FIELD,
  WITHDRAW_SEQUENCE_FIELD,
  type WithdrawCaseState,
} from '../utils/withdraw-case-state';

/** Shown after a successful withdraw. */
export const WITHDRAWN_MESSAGE =
  'Case withdrawn. No one will review it. Reload the page to see it in your list.';

/** Props for {@link WithdrawCaseForm}. */
export interface WithdrawCaseFormProps {
  /** Server action that withdraws the case. */
  readonly withdrawAction: (
    previous: WithdrawCaseState,
    formData: FormData,
  ) => Promise<WithdrawCaseState>;
  readonly caseId: string;
  /** The case view's `lastSequence`, sent back so a race gets a conflict instead of a guess. */
  readonly lastSequence: number;
}

/**
 * Renders the withdraw button and the live region that reports the result.
 *
 * @param props - The action, the case, and the sequence the page showed.
 * @returns The form.
 */
export function WithdrawCaseForm({
  withdrawAction,
  caseId,
  lastSequence,
}: WithdrawCaseFormProps): ReactElement {
  const [state, formAction, isPending] = useActionState(withdrawAction, IDLE_WITHDRAW_STATE);
  return (
    <form action={formAction}>
      <input type="hidden" name={WITHDRAW_CASE_FIELD} value={caseId} />
      <input type="hidden" name={WITHDRAW_SEQUENCE_FIELD} value={lastSequence} />
      {state.kind === 'withdrawn' ? null : (
        <button
          type="submit"
          aria-disabled={isPending}
          onClick={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
        >
          Withdraw this case
        </button>
      )}
      <div role="status" aria-live="polite">
        {isPending ? <p>Withdrawing…</p> : null}
        {state.kind === 'withdrawn' ? <p>{WITHDRAWN_MESSAGE}</p> : null}
        {state.kind === 'changed' ? (
          <div className="notice notice--caution">
            <p>{CASE_CHANGED}</p>
          </div>
        ) : null}
        {state.kind === 'rejected' ? (
          <div className="notice notice--problem">
            <p>{FORM_REJECTED}</p>
          </div>
        ) : null}
        {state.kind === 'failed' ? (
          <div className="notice notice--problem">
            <p>
              <strong>{describeError(state.code).heading}.</strong> {state.message}
            </p>
            <p>{describeError(state.code).nextStep}</p>
            {state.requestId === null ? null : (
              <p>
                Support reference: <code>{state.requestId}</code>
              </p>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
