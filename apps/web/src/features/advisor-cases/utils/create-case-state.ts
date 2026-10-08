/**
 * @file The result of a create-case attempt as the form shows it.
 * @module @caa/web/features/advisor-cases/utils/create-case-state
 * @requirement FR-12
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ApiError, CaseView } from '@caa/api-contract';
import { type CaseStatus, ErrorCode } from '@caa/domain';

/** What a create-case form shows. Every field is serializable, so it can cross the action. */
export type CreateCaseState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'created';
      readonly status: CaseStatus;
      readonly createdAt: string;
    }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The state before anything is submitted. */
export const IDLE_CREATE_CASE_STATE: CreateCaseState = { kind: 'idle' };

/**
 * Builds the form state for a created case.
 *
 * @param view - The case the API returned.
 * @returns The created state, carrying the status and time as the API returned them.
 */
export function toCreatedState(view: CaseView): CreateCaseState {
  return { kind: 'created', status: view.status, createdAt: view.createdAt };
}

/**
 * Builds the form state for an API error.
 *
 * @param error - The error envelope.
 * @returns `duplicate` for 409 `REVISION_CONFLICT`, the only conflict create can raise; otherwise
 *   the error's own code and message, which the shared notice wording explains.
 */
export function toCreateFailedState(
  error: Pick<ApiError, 'code' | 'message' | 'requestId'>,
): CreateCaseState {
  if (error.code === ErrorCode.RevisionConflict) {
    return { kind: 'duplicate' };
  }
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}
