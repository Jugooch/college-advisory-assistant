/**
 * @file The withdraw form: its fields, parsing, and the state it shows.
 * @module @caa/web/features/advisor-cases/utils/withdraw-case-state
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ApiError } from '@caa/api-contract';
import { CaseAction, type CaseId, CaseIdSchema, ErrorCode } from '@caa/domain';

/** Form field that carries the case ID. */
export const WITHDRAW_CASE_FIELD = 'caseId';

/** Form field that carries the `lastSequence` the page showed. */
export const WITHDRAW_SEQUENCE_FIELD = 'expectedSequence';

/** What the withdraw form shows. Every field is serializable. */
export type WithdrawCaseState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'withdrawn' }
  | { readonly kind: 'changed' }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The state before anything is submitted. */
export const IDLE_WITHDRAW_STATE: WithdrawCaseState = { kind: 'idle' };

/** A parsed withdraw form. */
export interface WithdrawCaseForm {
  readonly caseId: CaseId;
  readonly expectedSequence: number;
}

/**
 * Parses a submitted withdraw form.
 *
 * @param formData - The submitted form.
 * @returns The case and the sequence the student saw, or `null` when either doesn't parse.
 */
export function parseWithdrawForm(formData: FormData): WithdrawCaseForm | null {
  const caseId = CaseIdSchema.safeParse(formData.get(WITHDRAW_CASE_FIELD));
  const raw = formData.get(WITHDRAW_SEQUENCE_FIELD);
  const sequence = typeof raw === 'string' && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
  return caseId.success && sequence !== null
    ? { caseId: caseId.data, expectedSequence: sequence }
    : null;
}

/** The action a withdraw sends. */
export const WITHDRAW_ACTION = CaseAction.Withdraw;

/**
 * Builds the form state for an API error.
 *
 * @param error - The error envelope.
 * @returns `changed` for 409 `REVISION_CONFLICT`; otherwise the error's own code and message.
 */
export function toWithdrawFailedState(
  error: Pick<ApiError, 'code' | 'message' | 'requestId'>,
): WithdrawCaseState {
  if (error.code === ErrorCode.RevisionConflict) {
    return { kind: 'changed' };
  }
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}
