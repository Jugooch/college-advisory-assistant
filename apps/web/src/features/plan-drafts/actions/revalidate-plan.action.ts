/**
 * @file Server action: asks the API to revalidate a plan, which appends a new revision.
 * @module @caa/web/features/plan-drafts/actions/revalidate-plan
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/standards/06-frontend.md
 */
'use server';

import { ApiError } from '@caa/api-contract';

import { revalidatePlan } from '@/api/plan-drafts.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { parseRevalidateForm } from '../utils/revalidate-form';
import {
  type RevalidateState,
  toRevalidatedState,
  toRevalidateFailedState,
} from '../utils/revalidate-state';

/**
 * Sends the revision the student was looking at to the API, which replays that revision's
 * stored inputs on current records. The tenant and user come from the session, never the form.
 * Nothing revalidates unless the student submits this form (ADR-0013 §4).
 *
 * @param _previous - The form's last state, unused: every submission starts fresh.
 * @param formData - The submitted revalidate form.
 * @returns The new revision, the conflict, the referral, the API's own error, or `rejected` when
 *   the form didn't parse and nothing was sent.
 */
export async function revalidatePlanAction(
  _previous: RevalidateState,
  formData: FormData,
): Promise<RevalidateState> {
  const form = parseRevalidateForm(formData);
  if (form === null) {
    return { kind: 'rejected' };
  }
  const plan = await keepApiError(revalidatePlan(form.studentId, form.planId, form.body));
  return plan instanceof ApiError
    ? toRevalidateFailedState(plan)
    : toRevalidatedState(plan, form.hadSelection);
}
