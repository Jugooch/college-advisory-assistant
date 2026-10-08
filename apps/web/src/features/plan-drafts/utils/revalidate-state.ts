/**
 * @file The result of a revalidate attempt as the form shows it, and the wording for each state.
 * @module @caa/web/features/plan-drafts/utils/revalidate-state
 * @requirement FR-11
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ApiError, PlanView } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';

/** What happened to the student's earlier choice of option. */
export type SelectionOutcome = 'carried' | 'chosen-again' | 'none';

/** What a revalidate form shows. Every field is serializable, so it can cross the action. */
export type RevalidateState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'revalidated';
      readonly revision: number;
      readonly selection: SelectionOutcome;
    }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'blocked'; readonly code: 'STALE_SOURCE' | 'SOURCE_UNAVAILABLE' }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The state before anything is submitted. */
export const IDLE_REVALIDATE_STATE: RevalidateState = { kind: 'idle' };

/** Shown on 409 `REVISION_CONFLICT`: a newer revision exists, so the page loads it. */
export const REVALIDATE_CONFLICT_MESSAGE =
  'This draft changed since you opened it, so we loaded the latest revision. Revalidate again if you still want to.';

/** Shown when the form's own fields didn't parse, so nothing was sent. */
export const REVALIDATE_REJECTED_MESSAGE =
  'This request couldn’t be read, so nothing was changed. Reload the page and try again.';

// SAFETY: the referral says nothing was written and the saved revision is unchanged (ADR-0013 §4).
const BLOCKED_WORDING: Readonly<Record<'STALE_SOURCE' | 'SOURCE_UNAVAILABLE', string>> = {
  STALE_SOURCE:
    'We can’t revalidate right now because your records are being refreshed. Nothing was changed. Try again later, or ask an advisor.',
  SOURCE_UNAVAILABLE:
    'We can’t revalidate right now because a source system is unavailable. Nothing was changed. Try again later, or ask an advisor.',
};

/**
 * Words the revalidate referral for a blocked attempt.
 *
 * @param code - `STALE_SOURCE` or `SOURCE_UNAVAILABLE`.
 * @returns A plain sentence that says nothing was written and where to turn.
 */
export function describeBlockedRevalidation(code: 'STALE_SOURCE' | 'SOURCE_UNAVAILABLE'): string {
  return BLOCKED_WORDING[code];
}

/**
 * Words the new revision and what became of the earlier choice.
 *
 * @param state - A revalidated state.
 * @returns One or two plain sentences.
 */
export function describeRevalidated(
  state: Extract<RevalidateState, { kind: 'revalidated' }>,
): string {
  const added = `Revalidation finished. Revision ${String(state.revision)} was added; the earlier revisions are kept.`;
  if (state.selection === 'carried') {
    return `${added} Your earlier choice is still available and carried over.`;
  }
  if (state.selection === 'chosen-again') {
    return `${added} Your earlier choice is no longer available; choose an option.`;
  }
  return added;
}

/**
 * Works out what became of the earlier choice. The server carries a selection over only when
 * the identical sections are among the new options, so this reads the result, never decides it.
 *
 * @param hadSelection - Whether the revision the student saw had a chosen option.
 * @param plan - The plan the API returned.
 * @returns `none` when nothing was chosen before, `carried` when the new revision keeps a choice.
 */
export function toSelectionOutcome(hadSelection: boolean, plan: PlanView): SelectionOutcome {
  if (!hadSelection) {
    return 'none';
  }
  return plan.latest.selectedSectionIds === null ? 'chosen-again' : 'carried';
}

/**
 * Builds the form state for a revalidated plan.
 *
 * @param plan - The plan the API returned.
 * @param hadSelection - Whether the earlier revision had a chosen option.
 * @returns The revalidated state, carrying the new revision as the API numbered it.
 */
export function toRevalidatedState(plan: PlanView, hadSelection: boolean): RevalidateState {
  return {
    kind: 'revalidated',
    revision: plan.latest.revision,
    selection: toSelectionOutcome(hadSelection, plan),
  };
}

/**
 * Builds the form state for an API error.
 *
 * @param error - The error envelope.
 * @returns `conflict` for `REVISION_CONFLICT`, `blocked` for `STALE_SOURCE` and
 *   `SOURCE_UNAVAILABLE`; otherwise the error's own code and message.
 */
export function toRevalidateFailedState(
  error: Pick<ApiError, 'code' | 'message' | 'requestId'>,
): RevalidateState {
  if (error.code === ErrorCode.RevisionConflict) {
    return { kind: 'conflict' };
  }
  if (error.code === ErrorCode.StaleSource || error.code === ErrorCode.SourceUnavailable) {
    return { kind: 'blocked', code: error.code };
  }
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}
