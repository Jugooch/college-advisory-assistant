/**
 * @file Server action: opens an advisor case for the signed-in student.
 * @module @caa/web/features/advisor-cases/actions/create-case
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-04
 * @see docs/standards/06-frontend.md
 */
'use server';

import { ApiError } from '@caa/api-contract';

import { createCase } from '@/api/cases.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { parseCreateCaseForm } from '../utils/create-case-form';
import {
  type CreateCaseState,
  toCreatedState,
  toCreateFailedState,
} from '../utils/create-case-state';

/**
 * Sends the submitted request to the API. The tenant and user come from the session, never the
 * form. Nothing is sent outside the app.
 *
 * @param _previous - The form's last state, unused: every submission starts fresh.
 * @param formData - The submitted form.
 * @returns The created case, `duplicate` when the plan already has an open case, the API's own
 *   error, or `rejected` when the form didn't parse and nothing was sent.
 */
export async function createCaseAction(
  _previous: CreateCaseState,
  formData: FormData,
): Promise<CreateCaseState> {
  const form = parseCreateCaseForm(formData);
  if (form === null) {
    return { kind: 'rejected' };
  }
  const view = await keepApiError(createCase(form.studentId, form.body));
  return view instanceof ApiError ? toCreateFailedState(view) : toCreatedState(view);
}
