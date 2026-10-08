/**
 * @file Server action: saves a schedule option, or a result with no options, as a plan draft.
 * @module @caa/web/features/plan-drafts/actions/save-plan-draft
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/standards/06-frontend.md
 */
'use server';

import { ApiError } from '@caa/api-contract';

import { savePlanDraft } from '@/api/plan-drafts.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { parseSaveDraftForm } from '../utils/save-draft-form';
import { type SaveDraftState, toFailedState, toSavedState } from '../utils/save-draft-state';

/**
 * Sends the submitted request, chosen sections, and pinned inputs to the API, which replays the
 * search and appends a revision. The tenant and user come from the session, never the form.
 *
 * @param _previous - The form's last state, unused: every submission starts fresh.
 * @param formData - The submitted save-draft form.
 * @returns The saved revision, the conflict, the API's own error, or `rejected` when the form
 *   didn't parse and nothing was sent.
 */
export async function savePlanDraftAction(
  _previous: SaveDraftState,
  formData: FormData,
): Promise<SaveDraftState> {
  const form = parseSaveDraftForm(formData);
  if (form === null) {
    return { kind: 'rejected' };
  }
  const plan = await keepApiError(savePlanDraft(form.studentId, form.body));
  return plan instanceof ApiError ? toFailedState(plan) : toSavedState(plan);
}
