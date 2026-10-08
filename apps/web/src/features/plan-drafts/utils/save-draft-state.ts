/**
 * @file The result of a save-draft attempt as the form shows it, and the wording for each state.
 * @module @caa/web/features/plan-drafts/utils/save-draft-state
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ApiError, PlanFreshnessView, PlanView } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

/** What a save-draft form shows. Every field is serializable, so it can cross the action. */
export type SaveDraftState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'saved';
      readonly revision: number;
      readonly savedAt: string;
      readonly freshness: PlanFreshnessView;
      readonly isResultUnavailable: boolean;
    }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The state before anything is submitted. */
export const IDLE_SAVE_DRAFT_STATE: SaveDraftState = { kind: 'idle' };

/** Shown after a save. A draft is a plan, never a registration (AC16). */
export const SAVED_MESSAGE = 'Draft saved. This is a plan, not a registration.';

/** Shown on 409 `REVISION_CONFLICT`: the options the student saw are no longer what the server finds. */
export const CONFLICT_MESSAGE = 'Your options changed since you loaded them. Refresh options.';

/** Shown when the form's own fields didn't parse, so nothing was sent. */
export const REJECTED_MESSAGE =
  'This draft couldn’t be read, so nothing was saved. Refresh options and try again.';

/** Shown when the saved result no longer parses; it is never repaired or partly shown. */
export const RESULT_UNAVAILABLE_MESSAGE =
  'The saved result can’t be displayed right now. Nothing is shown in its place. Ask your advisor to review this draft.';

/**
 * Builds the form state for a saved plan.
 *
 * @param plan - The plan the API returned.
 * @returns The saved state, carrying the new revision as the API numbered it.
 */
export function toSavedState(plan: PlanView): SaveDraftState {
  const { revision, createdAt, freshness } = plan.latest;
  const isResultUnavailable = plan.latest.resultUnavailable;
  return { kind: 'saved', revision, savedAt: createdAt, freshness, isResultUnavailable };
}

/**
 * Builds the form state for an API error.
 *
 * @param error - The error envelope.
 * @returns `conflict` for `REVISION_CONFLICT`; otherwise the error's own code and message, which
 *   the shared notice wording explains.
 */
export function toFailedState(
  error: Pick<ApiError, 'code' | 'message' | 'requestId'>,
): SaveDraftState {
  if (error.code === ErrorCode.RevisionConflict) {
    return { kind: 'conflict' };
  }
  return {
    kind: 'failed',
    code: error.code,
    message: error.message,
    requestId: error.requestId,
  };
}
