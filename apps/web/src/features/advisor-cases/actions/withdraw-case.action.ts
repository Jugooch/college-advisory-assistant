/**
 * @file Server action: withdraws one of the signed-in student's open cases.
 * @module @caa/web/features/advisor-cases/actions/withdraw-case
 * @requirement FR-12
 * @requirement NFR-04
 * @see docs/standards/06-frontend.md
 */
'use server';

import { ApiError } from '@caa/api-contract';

import { addCaseEvent } from '@/api/cases.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import {
  parseWithdrawForm,
  toWithdrawFailedState,
  WITHDRAW_ACTION,
  type WithdrawCaseState,
} from '../utils/withdraw-case-state';

/**
 * Sends a `WITHDRAW` event with the sequence the student saw. The API's case logic decides whether
 * it is allowed; the form is only offered when the case view lists `WITHDRAW` in `allowedActions`.
 * The events endpoint is built in #412; until then the API answers with an error, shown as is.
 *
 * @param _previous - The form's last state, unused: every submission starts fresh.
 * @param formData - The submitted form.
 * @returns `withdrawn` on success, `changed` on a sequence race, the API's own error, or
 *   `rejected` when the form didn't parse and nothing was sent.
 */
export async function withdrawCaseAction(
  _previous: WithdrawCaseState,
  formData: FormData,
): Promise<WithdrawCaseState> {
  const form = parseWithdrawForm(formData);
  if (form === null) {
    return { kind: 'rejected' };
  }
  const view = await keepApiError(
    addCaseEvent(form.caseId, { action: WITHDRAW_ACTION, expectedSequence: form.expectedSequence }),
  );
  return view instanceof ApiError ? toWithdrawFailedState(view) : { kind: 'withdrawn' };
}
