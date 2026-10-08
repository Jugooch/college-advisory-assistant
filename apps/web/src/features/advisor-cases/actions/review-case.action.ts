/**
 * @file Server action: claims, releases, or resolves a case as the signed-in advisor or admin.
 * @module @caa/web/features/advisor-cases/actions/review-case
 * @requirement FR-12
 * @requirement NFR-04
 * @see docs/standards/06-frontend.md
 */
'use server';

import { revalidatePath } from 'next/cache';

import { ApiError } from '@caa/api-contract';

import { addCaseEvent } from '@/api/cases.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import {
  parseReviewForm,
  type ReviewCaseState,
  toReviewFailedState,
} from '../utils/review-case-state';

/** The page paths whose data an action changes: the case itself and the queue. */
const QUEUE_PATH = '/advisor/queue';

/**
 * Sends one event with the sequence the advisor saw. The API's case logic decides whether it is
 * allowed; the form is only offered when the case view lists the action in `allowedActions`.
 * Whether the advisor may see this student is decided by the API from the session.
 *
 * @param _previous - The screen's last state, unused: every submission starts fresh.
 * @param formData - The submitted form.
 * @returns `done` on success, `changed` on a sequence race, `gone` when the case is no longer
 *   available (404), the API's own error otherwise, or `rejected` when the form didn't parse and
 *   nothing was sent. On success and on a race the pages are refreshed.
 */
export async function reviewCaseAction(
  _previous: ReviewCaseState,
  formData: FormData,
): Promise<ReviewCaseState> {
  const form = parseReviewForm(formData);
  if (form === null) {
    return { kind: 'rejected' };
  }
  const { expectedSequence } = form.request;
  const casePath = `/advisor/cases/${form.caseId}`;
  const result = await keepApiError(addCaseEvent(form.caseId, form.request));
  if (result instanceof ApiError) {
    const state = toReviewFailedState(result, expectedSequence);
    if (state.kind === 'changed') {
      revalidatePath(casePath);
      revalidatePath(QUEUE_PATH);
    }
    return state;
  }
  revalidatePath(casePath);
  revalidatePath(QUEUE_PATH);
  return { kind: 'done', action: form.action, expectedSequence };
}
